//! Local HTTP listener that AI tools call from their hooks.
//!
//! Endpoints (127.0.0.1 only):
//!   POST /v1/event/{source}/{busy|idle|attention|end}   body: optional JSON with `session_id` / `conversation_id`
//!   POST /v1/busy | /v1/idle | /v1/attention             manual / scripts (?session=...)
//!   GET  /v1/status                                      current agent status
//!   GET  /v1/integrations                                integration status (for the setup skill)
//!   POST /v1/setup                                       connect every detected tool (needs `X-Ghars: 1`)
//!
//! Requests carrying an `Origin` or `Sec-Fetch-*` header, or a `Host` other than 127.0.0.1 /
//! localhost, are rejected so web pages (including DNS-rebinding ones) can't drive or read the app.
//! Hook responses are always 2xx with an empty body: some tools treat a JSON body as
//! instructions (e.g. "block this stop").

use crate::AppState;
use crate::integrations;
use crate::tracker::{AgentEvent, Kind, Status, Tracker};
use std::io::Read;
use std::sync::{Arc, Mutex, OnceLock, PoisonError, mpsc};
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Header, Method, Request, Response, Server};

pub const PORT: u16 = 47821;

/// Requests are handled by a few workers, so one client stalling mid-body can't hold up the hooks.
const WORKERS: usize = 4;

static BIND_ERROR: OnceLock<String> = OnceLock::new();

/// Why the listener isn't running (e.g. another app already uses the port), if it failed to start.
pub fn bind_error() -> Option<String> {
    BIND_ERROR.get().cloned()
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let server = match Server::http(("127.0.0.1", PORT)) {
            Ok(s) => s,
            Err(e) => {
                let message = format!("Ghars could not listen on 127.0.0.1:{PORT}: {e}");
                log::error!("{message}");
                let _ = BIND_ERROR.set(message);
                return;
            }
        };
        let (tx, rx) = mpsc::channel::<Request>();
        let rx = Arc::new(Mutex::new(rx));
        for _ in 0..WORKERS {
            let (app, rx) = (app.clone(), Arc::clone(&rx));
            std::thread::spawn(move || {
                loop {
                    // Bound first so the receiver lock is released before handling the request.
                    let next = rx.lock().unwrap_or_else(PoisonError::into_inner).recv();
                    let Ok(req) = next else { break };
                    handle(&app, req);
                }
            });
        }
        for req in server.incoming_requests() {
            let _ = tx.send(req);
        }
    });
}

fn handle(app: &AppHandle, mut req: Request) {
    let from_browser = req.headers().iter().any(|h| browser_header(h.field.as_str().as_str()));
    let host = req
        .headers()
        .iter()
        .find(|h| h.field.equiv("Host"))
        .map(|h| h.value.as_str().to_string());
    if from_browser || !host.as_deref().is_none_or(local_host) {
        let _ = req.respond(Response::empty(403));
        return;
    }

    let url = req.url().to_string();
    let (path, query) = url.split_once('?').unwrap_or((&url, ""));
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    let method = req.method().clone();

    match (method, segments.as_slice()) {
        (Method::Post, ["v1", "event", source, kind]) => {
            let Some(kind) = Kind::parse(kind) else {
                return respond_empty(req, 404);
            };
            if !valid_source(source) {
                return respond_empty(req, 400);
            }
            // Ghars's own hooks send no body; scripts may send JSON naming their session.
            let mut body = String::new();
            if req.as_reader().take(256 * 1024).read_to_string(&mut body).is_err() {
                return respond_empty(req, 400);
            }
            let json: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            // Cursor also runs Claude Code hooks; attribute those calls to Cursor.
            let source = if json.get("cursor_version").is_some() {
                "cursor"
            } else {
                source
            };
            let session = ["session_id", "conversation_id", "conversationId"]
                .iter()
                .find_map(|k| json.get(*k).and_then(|v| v.as_str()))
                .unwrap_or("default")
                .to_string();
            record(app, source, &session, kind);
            respond_empty(req, 200);
        }
        (Method::Post, ["v1", "busy"]) => record_manual(app, req, query, Kind::Busy),
        (Method::Post, ["v1", "idle"]) => record_manual(app, req, query, Kind::Idle),
        (Method::Post, ["v1", "attention"]) => record_manual(app, req, query, Kind::Attention),
        (Method::Get, ["v1", "status"]) => {
            let status = tracker(app).status();
            respond_json(req, &status);
        }
        (Method::Get, ["v1", "integrations"]) => respond_json(req, &integrations::all()),
        (Method::Post, ["v1", "setup"]) => {
            let trusted = req
                .headers()
                .iter()
                .any(|h| h.field.equiv("X-Ghars") && h.value.as_str() == "1");
            if !trusted {
                return respond_empty(req, 403);
            }
            let results: Vec<_> = integrations::all()
                .into_iter()
                .filter(|i| i.detected)
                .map(|i| {
                    integrations::install(&i.id).unwrap_or_else(|e| integrations::IntegrationStatus { note: e, ..i })
                })
                .collect();
            let _ = app.emit("integrations-changed", ());
            respond_json(req, &results);
        }
        (Method::Get, ["health"]) | (Method::Get, ["v1", "health"]) => respond_empty(req, 200),
        _ => respond_empty(req, 404),
    }
}

fn record_manual(app: &AppHandle, req: Request, query: &str, kind: Kind) {
    let session = query
        .split('&')
        .find_map(|p| p.strip_prefix("session="))
        .unwrap_or("manual")
        .to_string();
    record(app, "manual", &session, kind);
    respond_empty(req, 200);
}

fn tracker(app: &AppHandle) -> std::sync::MutexGuard<'_, Tracker> {
    app.state::<AppState>()
        .inner()
        .tracker
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

pub fn record(app: &AppHandle, source: &str, session: &str, kind: Kind) {
    // Apply and emit under one lock, so concurrent workers can't deliver statuses out of order.
    let mut tracker = tracker(app);
    tracker.apply(source, session, kind);
    emit(app, kind, source, tracker.status());
}

/// Sends the event plus the aggregate status of all sessions to the island.
pub fn broadcast(app: &AppHandle, kind: Kind, source: &str) {
    let tracker = tracker(app);
    emit(app, kind, source, tracker.status());
}

fn emit(app: &AppHandle, kind: Kind, source: &str, status: Status) {
    let _ = app.emit_to(
        "island",
        "agent",
        AgentEvent {
            kind,
            source: source.to_string(),
            status,
        },
    );
}

/// Browsers add `Origin` to cross-origin requests and `Sec-Fetch-*` to every request;
/// hooks and scripts send neither.
fn browser_header(name: &str) -> bool {
    name.eq_ignore_ascii_case("Origin") || name.get(..10).is_some_and(|p| p.eq_ignore_ascii_case("Sec-Fetch-"))
}

/// Browsers send no `Origin` on same-origin GETs, so a DNS-rebinding page (evil.example
/// resolving to 127.0.0.1) could still read `/v1/status`. Its `Host` header gives it away.
fn local_host(host: &str) -> bool {
    let name = host
        .rsplit_once(':')
        .filter(|(_, port)| *port == PORT.to_string())
        .map_or(host, |(name, _)| name);
    name == "127.0.0.1" || name.eq_ignore_ascii_case("localhost")
}

fn valid_source(s: &str) -> bool {
    !s.is_empty() && s.len() <= 32 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn respond_empty(req: Request, code: u16) {
    let _ = req.respond(Response::empty(code));
}

fn respond_json<T: serde::Serialize>(req: Request, value: &T) {
    let body = serde_json::to_string(value).unwrap_or_else(|_| "{}".into());
    let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
    let _ = req.respond(Response::from_string(body).with_header(header));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_loopback_hosts_are_accepted() {
        for ok in ["127.0.0.1:47821", "127.0.0.1", "localhost:47821", "LocalHost"] {
            assert!(local_host(ok), "{ok}");
        }
        for bad in [
            "evil.example:47821",
            "evil.example",
            "127.0.0.1.evil.example:47821",
            "localhost:80",
            "0.0.0.0:47821",
            "",
        ] {
            assert!(!local_host(bad), "{bad}");
        }
    }

    #[test]
    fn browser_headers_are_recognised() {
        for browser in ["Origin", "origin", "Sec-Fetch-Site", "sec-fetch-mode", "SEC-FETCH-DEST"] {
            assert!(browser_header(browser), "{browser}");
        }
        for tool in ["Host", "Content-Type", "X-Ghars", "Sec-Fetch", "User-Agent", ""] {
            assert!(!browser_header(tool), "{tool}");
        }
    }
}
