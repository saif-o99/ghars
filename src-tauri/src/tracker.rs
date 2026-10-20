//! Tracks which AI agent sessions are currently working.

use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::time::{Duration, Instant};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Busy,
    Idle,
    Attention,
    End,
}

impl Kind {
    pub fn parse(s: &str) -> Option<Kind> {
        match s {
            "busy" => Some(Kind::Busy),
            "idle" => Some(Kind::Idle),
            "attention" => Some(Kind::Attention),
            "end" => Some(Kind::End),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct Status {
    pub busy: bool,
    pub attention: bool,
    pub sources: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentEvent {
    pub kind: Kind,
    pub source: String,
    #[serde(flatten)]
    pub status: Status,
}

struct Session {
    source: String,
    attention: bool,
    updated: Instant,
}

#[derive(Default)]
pub struct Tracker {
    sessions: HashMap<String, Session>,
}

/// A turn that never reported its end (e.g. the user pressed Esc in Claude Code,
/// which fires no hook) stops counting as busy after this long.
const STALE_AFTER: Duration = Duration::from_secs(20 * 60);

/// Session ids come from anyone who can reach the port, so keep the table small.
const MAX_SESSION_ID: usize = 128;
const MAX_SESSIONS: usize = 64;

impl Tracker {
    pub fn apply(&mut self, source: &str, session: &str, kind: Kind) {
        let session: String = session.chars().take(MAX_SESSION_ID).collect();
        let key = format!("{source}:{session}");
        match kind {
            Kind::Busy | Kind::Attention => {
                if !self.sessions.contains_key(&key) && self.sessions.len() >= MAX_SESSIONS {
                    let oldest = self
                        .sessions
                        .iter()
                        .min_by_key(|(_, s)| s.updated)
                        .map(|(k, _)| k.clone());
                    if let Some(oldest) = oldest {
                        self.sessions.remove(&oldest);
                    }
                }
                self.sessions.insert(
                    key,
                    Session {
                        source: source.to_string(),
                        attention: kind == Kind::Attention,
                        updated: Instant::now(),
                    },
                );
            }
            Kind::Idle | Kind::End => {
                self.sessions.remove(&key);
            }
        }
    }

    pub fn status(&self) -> Status {
        let sources: BTreeSet<String> = self.sessions.values().map(|s| s.source.clone()).collect();
        Status {
            busy: self.sessions.values().any(|s| !s.attention),
            attention: self.sessions.values().any(|s| s.attention),
            sources: sources.into_iter().collect(),
        }
    }

    /// Drops stale sessions; returns true if anything changed.
    pub fn expire(&mut self) -> bool {
        let before = self.sessions.len();
        self.sessions.retain(|_, s| s.updated.elapsed() < STALE_AFTER);
        before != self.sessions.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busy_until_every_session_is_idle() {
        let mut t = Tracker::default();
        t.apply("claude", "a", Kind::Busy);
        t.apply("codex", "b", Kind::Busy);
        assert!(t.status().busy);
        assert_eq!(t.status().sources, ["claude", "codex"]);
        t.apply("claude", "a", Kind::Idle);
        assert!(t.status().busy);
        t.apply("codex", "b", Kind::End);
        assert_eq!(t.status(), Status::default());
    }

    #[test]
    fn attention_is_separate_from_busy() {
        let mut t = Tracker::default();
        t.apply("claude", "a", Kind::Attention);
        let s = t.status();
        assert!(s.attention && !s.busy);
        t.apply("claude", "a", Kind::Busy);
        let s = t.status();
        assert!(s.busy && !s.attention);
    }

    #[test]
    fn session_table_is_bounded() {
        let mut t = Tracker::default();
        t.apply("claude", "first", Kind::Busy);
        std::thread::sleep(Duration::from_millis(5));
        for i in 0..MAX_SESSIONS * 2 {
            t.apply("script", &i.to_string(), Kind::Busy);
        }
        assert_eq!(t.sessions.len(), MAX_SESSIONS);
        assert!(!t.sessions.contains_key("claude:first"), "oldest evicted");
        t.apply("claude", &"x".repeat(10_000), Kind::Busy);
        assert!(t.sessions.keys().all(|k| k.len() <= "claude:".len() + MAX_SESSION_ID));
        t.apply("claude", &"x".repeat(20_000), Kind::Idle);
        assert!(
            !t.status().sources.contains(&"claude".to_string()),
            "same truncated id ends it"
        );
    }
}
