//! Installs/removes Ghars hooks in the config files of AI coding tools.
//!
//! Every hook we write is a shell command that POSTs (without a body, so no prompt or file
//! content ever reaches Ghars) to `127.0.0.1:47821/v1/event/...`; that URL is how we
//! recognise our own entries, so uninstalling never touches the user's other hooks.
//! The first time we modify a user's file we keep a `<file>.ghars.bak` copy next to it.

use crate::server::PORT;
use serde::Serialize;
use serde_json::{Map, Value, json};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationStatus {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub installed: bool,
    pub config_path: String,
    pub note: String,
}

struct Tool {
    id: &'static str,
    name: &'static str,
    note: &'static str,
}

static TOOLS: [Tool; 5] = [
    Tool {
        id: "claude",
        name: "Claude Code",
        note: "",
    },
    Tool {
        id: "cursor",
        name: "Cursor",
        note: "",
    },
    Tool {
        id: "codex",
        name: "Codex CLI",
        note: "Codex asks you to approve new hooks once: run /hooks inside Codex and trust the Ghars entries.",
    },
    Tool {
        id: "gemini",
        name: "Gemini CLI",
        note: "",
    },
    Tool {
        id: "copilot",
        name: "GitHub Copilot",
        note: "Copilot CLI and Copilot agent mode in VS Code both use these hooks. Restart Copilot CLI to load them.",
    },
];

/// Serialises every read-modify-write of a tool's config, so `/v1/setup` (server thread),
/// Settings and the startup migration can't overwrite each other's changes.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn lock() -> MutexGuard<'static, ()> {
    WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner)
}

fn marker() -> String {
    format!("127.0.0.1:{PORT}/v1/event/")
}

fn url(source: &str, kind: &str) -> String {
    format!("http://{}{source}/{kind}", marker())
}

/// Older versions used native HTTP hooks in Claude Code and allow-listed them here.
fn legacy_allowed_url() -> String {
    format!("http://127.0.0.1:{PORT}/*")
}

/// A shell command that pings Ghars and always exits 0, so it never fails or blocks the
/// calling tool, even when Ghars isn't running. It sends no body and ignores stdin.
fn ping(source: &str, kind: &str) -> String {
    let u = url(source, kind);
    if !cfg!(windows) {
        posix_ping(&u)
    } else if source == "codex" {
        // Codex runs hooks in the session's shell, or `cmd.exe /C` when it has none, so let
        // PowerShell run the ping: this line works from cmd, PowerShell and bash alike.
        format!("powershell -NoProfile -Command \"{}\"", windows_ping(&u))
    } else {
        // Claude Code uses Git Bash (PowerShell without it), Cursor and Gemini use PowerShell
        // (Cursor: bash under MSYS).
        windows_ping(&u)
    }
}

/// The ping for `sh`/`bash` on macOS and Linux.
fn posix_ping(url: &str) -> String {
    format!("curl -s -m 2 -o /dev/null -X POST {url} || true")
}

/// The ping for Windows: `; exit 0` and `-o NUL` mean the same in PowerShell (5.1 and 7) and
/// Git Bash. Output is discarded because Claude adds a prompt hook's stdout to the
/// conversation, Copilot parses it as a decision, and whatever answers on the port might not
/// be Ghars.
fn windows_ping(url: &str) -> String {
    format!("curl.exe -s -m 2 -o NUL -X POST {url}; exit 0")
}

fn home() -> Result<PathBuf, String> {
    dirs::home_dir()
        .filter(|h| !h.as_os_str().is_empty())
        .ok_or_else(|| "cannot find your home folder".to_string())
}

/// Reads a config-folder override (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`) from the environment,
/// falling back to the login shell's when the app was started outside a terminal.
fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| login_shell_var(var))
}

fn config_dir(id: &str) -> Result<PathBuf, String> {
    match id {
        "claude" => Ok(match env_dir("CLAUDE_CONFIG_DIR") {
            Some(dir) => dir,
            None => home()?.join(".claude"),
        }),
        "cursor" => Ok(home()?.join(".cursor")),
        "codex" => Ok(match env_dir("CODEX_HOME") {
            Some(dir) => dir,
            None => home()?.join(".codex"),
        }),
        "gemini" => Ok(home()?.join(".gemini")),
        "copilot" => Ok(match env_dir("COPILOT_HOME") {
            Some(dir) => dir,
            None => home()?.join(".copilot"),
        }),
        _ => Err(format!("unknown integration: {id}")),
    }
}

fn config_file(id: &str) -> Result<PathBuf, String> {
    let name = match id {
        "claude" | "gemini" => "settings.json",
        "cursor" | "codex" => "hooks.json",
        "copilot" => "hooks/ghars.json",
        _ => return Err(format!("unknown integration: {id}")),
    };
    Ok(config_dir(id)?.join(name))
}

/// Copilot loads every `*.json` in its `hooks` folder, so Ghars keeps its hooks in a file of
/// its own there instead of editing the user's settings: no backup needed, and disconnecting
/// deletes the file once nothing but Ghars's hooks was in it.
fn own_file(id: &str) -> bool {
    id == "copilot"
}

fn tool(id: &str) -> Result<&'static Tool, String> {
    TOOLS
        .iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("unknown integration: {id}"))
}

pub fn all() -> Vec<IntegrationStatus> {
    TOOLS.iter().map(status_of).collect()
}

pub fn status(id: &str) -> Result<IntegrationStatus, String> {
    tool(id).map(status_of)
}

/// Without a home folder (or config path) the tool is reported as not detected, with the reason as its note.
fn status_of(tool: &Tool) -> IntegrationStatus {
    let file = config_file(tool.id);
    IntegrationStatus {
        id: tool.id.into(),
        name: tool.name.into(),
        detected: config_dir(tool.id).is_ok_and(|d| d.is_dir()),
        installed: file
            .as_ref()
            .is_ok_and(|f| read_json(f).is_ok_and(|root| has_ours(&root))),
        config_path: file.as_ref().map(|f| f.display().to_string()).unwrap_or_default(),
        note: match &file {
            Ok(_) => tool.note.into(),
            Err(e) => e.clone(),
        },
    }
}

pub fn install(id: &str) -> Result<IntegrationStatus, String> {
    tool(id)?;
    let file = config_file(id)?;
    {
        let _guard = lock();
        let mut root = read_json(&file)?;
        add_ours(id, &mut root)?;
        write_json(&file, &root, !own_file(id))?;
    }
    status(id)
}

/// Rewrites the Ghars hooks of every connected tool whose entries an older version wrote,
/// so upgrades take effect without reconnecting. Problems are only logged.
pub fn migrate() {
    for tool in &TOOLS {
        if let Err(e) = migrate_one(tool.id) {
            log::warn!("could not update the Ghars hooks of {}: {e}", tool.name);
        }
    }
}

fn migrate_one(id: &str) -> Result<(), String> {
    let file = config_file(id)?;
    let _guard = lock();
    // A file we can't parse can't hold hooks we wrote; Settings reports it as not installed.
    let Ok(root) = read_json(&file) else { return Ok(()) };
    if !has_ours(&root) {
        return Ok(());
    }
    let mut updated = root.clone();
    add_ours(id, &mut updated)?;
    if updated != root {
        write_json(&file, &updated, !own_file(id))?;
        log::info!("updated the Ghars hooks in {}", file.display());
    }
    Ok(())
}

/// Replaces any previous Ghars hooks in `root` with the current set for `id`.
fn add_ours(id: &str, root: &mut Value) -> Result<(), String> {
    remove_ours(root);
    let obj = root.as_object_mut().ok_or("config root is not a JSON object")?;

    match id {
        "claude" => {
            // Command hooks rather than HTTP ones: Claude sends the prompt to HTTP hooks and reads their reply.
            let cmd = |kind: &str| json!({ "type": "command", "command": ping("claude", kind), "timeout": 5 });
            let hooks = section(obj, "hooks")?;
            push(hooks, "UserPromptSubmit", json!({ "hooks": [cmd("busy")] }))?;
            push(hooks, "Stop", json!({ "hooks": [cmd("idle")] }))?;
            push(
                hooks,
                "Notification",
                json!({ "matcher": "permission_prompt", "hooks": [cmd("attention")] }),
            )?;
            push(
                hooks,
                "Notification",
                json!({ "matcher": "idle_prompt", "hooks": [cmd("idle")] }),
            )?;
            push(hooks, "SessionEnd", json!({ "hooks": [cmd("end")] }))?;
        }
        "cursor" => {
            obj.entry("version").or_insert(json!(1));
            let cmd = |kind: &str| json!({ "command": ping("cursor", kind), "timeout": 5 });
            let hooks = section(obj, "hooks")?;
            push(hooks, "beforeSubmitPrompt", cmd("busy"))?;
            push(hooks, "stop", cmd("idle"))?;
            push(hooks, "sessionEnd", cmd("end"))?;
        }
        "codex" => {
            let cmd =
                |kind: &str| json!({ "hooks": [{ "type": "command", "command": ping("codex", kind), "timeout": 5 }] });
            let hooks = section(obj, "hooks")?;
            push(hooks, "UserPromptSubmit", cmd("busy"))?;
            push(hooks, "Stop", cmd("idle"))?;
            push(hooks, "Interrupt", cmd("idle"))?;
            push(hooks, "PermissionRequest", cmd("attention"))?;
            push(hooks, "SessionEnd", cmd("end"))?;
        }
        "gemini" => {
            // Gemini denies the action on unexpected exit codes; `ping` always exits 0.
            let cmd = |kind: &str| json!({ "hooks": [{ "name": format!("ghars-{kind}"), "type": "command", "command": ping("gemini", kind), "timeout": 5000 }] });
            let hooks = section(obj, "hooks")?;
            push(hooks, "BeforeAgent", cmd("busy"))?;
            push(hooks, "AfterAgent", cmd("idle"))?;
            push(hooks, "Notification", cmd("attention"))?;
            push(hooks, "SessionEnd", cmd("end"))?;
        }
        "copilot" => {
            // Copilot's own format (`version` 1, camelCase events), which VS Code's agent mode
            // also reads from `~/.copilot/hooks` (it maps these events to UserPromptSubmit, Stop
            // and SessionEnd and skips `notification`). Copilot runs `bash` on macOS/Linux and
            // `powershell` on Windows (pwsh in the CLI, Windows PowerShell in VS Code); a
            // non-zero exit only logs a warning for these events, and `ping` exits 0 anyway.
            obj.entry("version").or_insert(json!(1));
            let cmd = |kind: &str| {
                let u = url("copilot", kind);
                json!({ "type": "command", "bash": posix_ping(&u), "powershell": windows_ping(&u), "timeoutSec": 5 })
            };
            let mut attention = cmd("attention");
            attention["matcher"] = json!("permission_prompt|elicitation_dialog");
            let hooks = section(obj, "hooks")?;
            push(hooks, "userPromptSubmitted", cmd("busy"))?;
            push(hooks, "agentStop", cmd("idle"))?;
            push(hooks, "notification", attention)?;
            push(hooks, "sessionEnd", cmd("end"))?;
        }
        _ => return Err(format!("unknown integration: {id}")),
    }
    Ok(())
}

pub fn uninstall(id: &str) -> Result<IntegrationStatus, String> {
    tool(id)?;
    let file = config_file(id)?;
    {
        let _guard = lock();
        remove_from(id, &file)?;
    }
    status(id)
}

fn remove_from(id: &str, file: &Path) -> Result<(), String> {
    if !file.exists() {
        return Ok(());
    }
    let mut root = read_json(file)?;
    remove_ours(&mut root);
    let only_version = root.as_object().is_some_and(|o| o.keys().all(|k| k == "version"));
    if own_file(id) && only_version {
        return fs::remove_file(file).map_err(|e| format!("cannot remove {}: {e}", file.display()));
    }
    write_json(file, &root, !own_file(id))
}

fn read_json(file: &Path) -> Result<Value, String> {
    match fs::read_to_string(file) {
        Ok(text) => {
            // Some Windows editors save JSON with a byte-order mark.
            let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
            if text.trim().is_empty() {
                return Ok(json!({}));
            }
            serde_json::from_str(text).map_err(|e| {
                format!(
                    "{} is not plain JSON ({e}). Remove comments or add the Ghars hooks manually.",
                    file.display()
                )
            })
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(e) => Err(format!("cannot read {}: {e}", file.display())),
    }
}

/// `backup`: keep a one-time `<file>.ghars.bak` copy of a file Ghars didn't create itself.
fn write_json(file: &Path, value: &Value, backup: bool) -> Result<(), String> {
    static TEMP_COUNTER: AtomicU32 = AtomicU32::new(0);
    let failed = |e: std::io::Error| format!("cannot write {}: {e}", file.display());

    // Replace the real file behind a symlink (dotfile managers), not the link itself.
    let target = fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(failed)?;
    }
    let original = fs::metadata(&target).ok();
    if original.as_ref().is_some_and(|m| m.permissions().readonly()) {
        return Err(format!("{} is read-only", file.display()));
    }
    let backup_file = file.with_extension("json.ghars.bak");
    if backup && original.is_some() && !backup_file.exists() {
        fs::copy(&target, &backup_file).map_err(|e| format!("cannot back up {}: {e}", file.display()))?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    // Write a sibling temp file and rename it over the original, so a crash or a full disk
    // can never leave the tool's config half-written. The original's permissions carry over.
    let n = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = target.with_extension(format!("json.ghars.{}.{n}.tmp", std::process::id()));
    let result = fs::write(&temp, text + "\n")
        .and_then(|()| original.map_or(Ok(()), |m| fs::set_permissions(&temp, m.permissions())))
        .and_then(|()| fs::rename(&temp, &target));
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.map_err(failed)
}

fn section<'a>(obj: &'a mut Map<String, Value>, key: &str) -> Result<&'a mut Map<String, Value>, String> {
    obj.entry(key)
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| format!("\"{key}\" in the config is not a JSON object. Fix it or add the Ghars hooks manually."))
}

fn push(hooks: &mut Map<String, Value>, event: &str, entry: Value) -> Result<(), String> {
    let list = hooks.entry(event).or_insert_with(|| json!([])).as_array_mut();
    let list = list.ok_or_else(|| {
        format!("\"hooks.{event}\" in the config is not a list. Fix it or add the Ghars hooks manually.")
    })?;
    list.push(entry);
    Ok(())
}

fn mentions_us(value: &Value) -> bool {
    value.to_string().contains(&marker())
}

fn has_ours(root: &Value) -> bool {
    root.get("hooks")
        .and_then(Value::as_object)
        .is_some_and(|hooks| hooks.values().any(mentions_us))
}

/// Removes our hooks and nothing else: inside a matcher group (`{"matcher", "hooks": [...]}`)
/// only our hook objects go, and the group only once it is empty; flat entries (Cursor) go
/// whole. Event lists and the `hooks` object we emptied are pruned.
fn remove_ours(root: &mut Value) {
    let Some(obj) = root.as_object_mut() else { return };
    if let Some(Value::Array(allowed)) = obj.get_mut("allowedHttpHookUrls") {
        let legacy = legacy_allowed_url();
        allowed.retain(|u| u.as_str() != Some(legacy.as_str()));
    }
    let Some(hooks) = obj.get_mut("hooks").and_then(Value::as_object_mut) else {
        return;
    };
    let mut emptied = vec![];
    for (event, list) in hooks.iter_mut() {
        let Some(entries) = list.as_array_mut() else { continue };
        let mut removed = false;
        entries.retain_mut(|entry| match entry.get_mut("hooks").and_then(Value::as_array_mut) {
            Some(inner) => {
                let before = inner.len();
                inner.retain(|h| !mentions_us(h));
                removed |= inner.len() != before;
                inner.len() == before || !inner.is_empty()
            }
            None => {
                let ours = mentions_us(entry);
                removed |= ours;
                !ours
            }
        });
        if removed && entries.is_empty() {
            emptied.push(event.clone());
        }
    }
    if emptied.is_empty() {
        return;
    }
    hooks.retain(|event, _| !emptied.contains(event));
    if hooks.is_empty() {
        obj.retain(|k, _| k != "hooks");
    }
}

/// Copies the bundled setup skill into the user-level skill folders that AI tools read.
pub fn install_skill() -> Result<Vec<String>, String> {
    const SKILL: &str = include_str!("../../skills/ghars-setup/SKILL.md");
    let _guard = lock();
    let mut written = vec![];
    for dir in [
        config_dir("claude")?.join("skills/ghars-setup"),
        home()?.join(".agents/skills/ghars-setup"),
    ] {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let file = dir.join("SKILL.md");
        fs::write(&file, SKILL).map_err(|e| e.to_string())?;
        written.push(file.display().to_string());
    }
    Ok(written)
}

#[cfg(windows)]
fn login_shell_var(_var: &str) -> Option<PathBuf> {
    None
}

/// Apps started from Finder, launchd or a desktop launcher don't see variables exported in
/// shell rc files, so ask the user's login shell once (all variables in one call) and
/// cache the answer. The shell gets 2 seconds; a hung rc file can't stall us longer.
#[cfg(not(windows))]
fn login_shell_var(var: &str) -> Option<PathBuf> {
    use std::collections::HashMap;
    use std::sync::OnceLock;
    static VARS: OnceLock<HashMap<String, String>> = OnceLock::new();
    let vars =
        VARS.get_or_init(|| login_shell_vars(&["CLAUDE_CONFIG_DIR", "CODEX_HOME", "COPILOT_HOME"]).unwrap_or_default());
    vars.get(var).map(PathBuf::from)
}

#[cfg(not(windows))]
fn login_shell_vars(names: &[&str]) -> Option<std::collections::HashMap<String, String>> {
    use std::io::Read;
    use std::os::unix::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const MARK: &str = "__GHARS__";
    const TIMEOUT: Duration = Duration::from_secs(2);
    let shell = std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "/bin/sh".into());
    let format: String = names.iter().map(|n| format!("\\n{MARK}{n}=%s")).collect();
    let args: Vec<String> = names.iter().map(|n| format!("\"${n}\"")).collect();
    let script = format!("printf '{format}\\n' {}", args.join(" "));
    let mut child = Command::new(shell)
        .args(["-ilc", &script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        // Own process group, so an interactive shell never fights us for the terminal.
        .process_group(0)
        .spawn()
        .ok()?;
    let started = Instant::now();
    let mut stdout = child.stdout.take()?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut out = String::new();
        let _ = stdout.read_to_string(&mut out);
        let _ = tx.send(out);
    });
    let out = rx.recv_timeout(TIMEOUT).ok();
    // The shell is normally gone once its output closes; either way, never wait past the deadline.
    while child.try_wait().is_ok_and(|s| s.is_none()) && started.elapsed() < TIMEOUT {
        std::thread::sleep(Duration::from_millis(10));
    }
    let _ = child.kill();
    let _ = child.wait();
    Some(parse_shell_vars(&out?, MARK))
}

/// Picks `<MARK>NAME=value` lines out of the shell's output (rc files may print other text).
#[cfg(any(not(windows), test))]
fn parse_shell_vars(out: &str, mark: &str) -> std::collections::HashMap<String, String> {
    out.lines()
        .filter_map(|line| line.strip_prefix(mark)?.split_once('='))
        .filter(|(_, value)| !value.is_empty())
        .map(|(name, value)| (name.to_string(), value.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_config() -> Value {
        json!({
            "model": "opus",
            "hooks": {
                "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }],
                "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "lint.sh" }] }]
            }
        })
    }

    /// Every `command`, `bash` and `powershell` string anywhere in `value`, with its key.
    fn commands(value: &Value) -> Vec<(String, String)> {
        match value {
            Value::Object(map) => map
                .iter()
                .flat_map(|(k, v)| match (k.as_str(), v) {
                    ("command" | "bash" | "powershell", Value::String(cmd)) => vec![(k.clone(), cmd.clone())],
                    _ => commands(v),
                })
                .collect(),
            Value::Array(items) => items.iter().flat_map(commands).collect(),
            _ => vec![],
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ghars-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn claude_install_keeps_user_hooks_and_is_idempotent() {
        let mut cfg = user_config();
        add_ours("claude", &mut cfg).unwrap();
        add_ours("claude", &mut cfg).unwrap();
        let hooks = &cfg["hooks"];
        assert_eq!(cfg["model"], "opus");
        assert_eq!(
            hooks["Stop"].as_array().unwrap().len(),
            2,
            "user Stop hook + ours, once"
        );
        assert_eq!(hooks["Stop"][0]["hooks"][0]["command"], "say done");
        assert_eq!(hooks["UserPromptSubmit"][0]["hooks"][0]["type"], "command");
        assert!(
            hooks["UserPromptSubmit"][0]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .contains("/v1/event/claude/busy")
        );
        assert_eq!(hooks["Notification"].as_array().unwrap().len(), 2);
        assert!(hooks["PreToolUse"].is_array());
        assert!(!cfg.to_string().contains("\"http\""), "no HTTP hooks");
    }

    #[test]
    fn copilot_install_fills_both_shells_and_is_idempotent() {
        let user_hook = json!({ "type": "command", "bash": "say done", "powershell": "echo done" });
        let mut cfg = json!({ "version": 1, "hooks": { "agentStop": [user_hook.clone()] } });
        add_ours("copilot", &mut cfg).unwrap();
        add_ours("copilot", &mut cfg).unwrap();
        let hooks = &cfg["hooks"];
        assert_eq!(cfg["version"], 1);
        assert_eq!(
            hooks["agentStop"].as_array().unwrap().len(),
            2,
            "user hook + ours, once"
        );
        assert_eq!(hooks["agentStop"][0], user_hook);
        // Event names Copilot CLI and VS Code both understand.
        for event in ["userPromptSubmitted", "agentStop", "notification", "sessionEnd"] {
            let ours = hooks[event].as_array().unwrap().last().unwrap();
            assert_eq!(ours["type"], "command", "{event}");
            assert_eq!(ours["timeoutSec"], 5, "{event}");
            assert!(ours["bash"].as_str().unwrap().starts_with("curl -s "), "{event}");
            assert!(
                ours["powershell"].as_str().unwrap().starts_with("curl.exe -s "),
                "{event}"
            );
            assert!(ours.get("command").is_none(), "{event}: per-OS fields only");
        }
        let busy = hooks["userPromptSubmitted"][0]["powershell"].as_str().unwrap();
        assert!(busy.contains("/v1/event/copilot/busy"));
        assert_eq!(
            hooks["notification"][0]["matcher"],
            "permission_prompt|elicitation_dialog"
        );
        assert!(config_file("copilot").unwrap().ends_with("hooks/ghars.json"));
    }

    #[test]
    fn copilot_uninstall_deletes_our_file_but_keeps_user_hooks() {
        let dir = temp_dir("copilot");
        let file = dir.join("hooks").join("ghars.json");
        let mut cfg = json!({});
        add_ours("copilot", &mut cfg).unwrap();
        write_json(&file, &cfg, !own_file("copilot")).unwrap();
        // Rewriting Ghars's own file (e.g. the startup migration) leaves no backup behind.
        write_json(&file, &cfg, !own_file("copilot")).unwrap();
        assert!(!dir.join("hooks").join("ghars.json.ghars.bak").exists());
        remove_from("copilot", &file).unwrap();
        assert!(!file.exists(), "file with only our hooks is deleted");
        remove_from("copilot", &file).unwrap();

        // Someone added their own hook to our file: only ours go.
        let user_hook = json!({ "type": "command", "bash": "say hi" });
        cfg["hooks"]["sessionStart"] = json!([user_hook.clone()]);
        write_json(&file, &cfg, false).unwrap();
        remove_from("copilot", &file).unwrap();
        assert_eq!(
            read_json(&file).unwrap(),
            json!({ "version": 1, "hooks": { "sessionStart": [user_hook] } })
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn uninstall_restores_the_original_config() {
        for id in ["claude", "cursor", "codex", "gemini", "copilot"] {
            let mut cfg = user_config();
            add_ours(id, &mut cfg).unwrap();
            assert!(has_ours(&cfg), "{id} installed");
            remove_ours(&mut cfg);
            assert!(!has_ours(&cfg), "{id} uninstalled");
            if id == "cursor" || id == "copilot" {
                cfg.as_object_mut().unwrap().remove("version");
            }
            assert_eq!(cfg, user_config(), "{id} uninstall");
        }
    }

    #[test]
    fn uninstall_drops_empty_hooks_key() {
        let mut cfg = json!({});
        add_ours("gemini", &mut cfg).unwrap();
        remove_ours(&mut cfg);
        assert_eq!(cfg, json!({}));
    }

    #[test]
    fn uninstall_keeps_a_user_hook_sharing_our_group() {
        let mut cfg = json!({});
        add_ours("claude", &mut cfg).unwrap();
        // The user added their own hook to the group Ghars created.
        let group = &mut cfg["hooks"]["Stop"][0]["hooks"];
        group
            .as_array_mut()
            .unwrap()
            .push(json!({ "type": "command", "command": "say done" }));
        remove_ours(&mut cfg);
        assert_eq!(
            cfg,
            json!({ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }] } })
        );
    }

    #[test]
    fn uninstall_leaves_unrelated_empty_entries_alone() {
        let original = json!({ "hooks": { "Stop": [{ "matcher": "x", "hooks": [] }], "PreToolUse": [] } });
        let mut cfg = original.clone();
        add_ours("claude", &mut cfg).unwrap();
        remove_ours(&mut cfg);
        assert_eq!(cfg, original);
    }

    #[test]
    fn every_command_always_exits_zero() {
        for id in ["claude", "cursor", "codex", "gemini", "copilot"] {
            let mut cfg = json!({});
            add_ours(id, &mut cfg).unwrap();
            let cmds = commands(&cfg);
            assert!(cmds.len() >= 3, "{id}");
            for (key, cmd) in cmds {
                assert!(cmd.contains(&format!("/v1/event/{id}/")), "{cmd}");
                let windows = key == "powershell" || (key == "command" && cfg!(windows));
                if windows {
                    assert!(cmd.ends_with("; exit 0") || cmd.ends_with("; exit 0\""), "{cmd}");
                } else {
                    assert!(cmd.ends_with(" || true"), "{cmd}");
                }
            }
        }
        let mut cfg = json!({});
        add_ours("cursor", &mut cfg).unwrap();
        assert_eq!(cfg["version"], 1);
    }

    #[test]
    fn unexpected_shapes_are_errors_not_overwritten() {
        let mut cfg = json!({ "hooks": ["oops"] });
        assert!(add_ours("claude", &mut cfg).is_err());
        let mut cfg = json!({ "hooks": { "Stop": { "not": "a list" } } });
        assert!(add_ours("codex", &mut cfg).is_err());
        assert!(add_ours("nope", &mut json!({})).is_err());
    }

    #[test]
    fn unknown_ids_are_errors() {
        assert!(install("nope").is_err());
        assert!(uninstall("nope").is_err());
        assert!(status("nope").is_err());
        assert!(config_file("nope").is_err());
    }

    #[test]
    fn write_json_replaces_the_file_and_keeps_one_backup() {
        let dir = temp_dir("write");
        let file = dir.join("settings.json");
        fs::write(&file, "{\"model\":\"opus\"}").unwrap();
        write_json(&file, &json!({ "a": 1 }), true).unwrap();
        write_json(&file, &json!({ "a": 2 }), true).unwrap();
        assert_eq!(read_json(&file).unwrap(), json!({ "a": 2 }));
        assert_eq!(
            fs::read_to_string(dir.join("settings.json.ghars.bak")).unwrap(),
            "{\"model\":\"opus\"}"
        );
        let mut names: Vec<_> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name()).collect();
        names.sort();
        assert_eq!(
            names,
            ["settings.json", "settings.json.ghars.bak"],
            "no temp files left"
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn read_json_skips_a_bom_and_refuses_comments() {
        let dir = temp_dir("read");
        let file = dir.join("settings.json");
        fs::write(&file, "\u{feff}{\"a\":1}").unwrap();
        assert_eq!(read_json(&file).unwrap(), json!({ "a": 1 }));
        fs::write(&file, "{\n// note\n\"a\":1}").unwrap();
        assert!(read_json(&file).is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn write_json_follows_symlinks_and_keeps_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("link");
        let real = dir.join("real.json");
        let link = dir.join("settings.json");
        fs::write(&real, "{}").unwrap();
        fs::set_permissions(&real, fs::Permissions::from_mode(0o600)).unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        write_json(&link, &json!({ "a": 1 }), true).unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(read_json(&real).unwrap(), json!({ "a": 1 }));
        assert_eq!(fs::metadata(&real).unwrap().permissions().mode() & 0o777, 0o600);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn claude_drops_the_legacy_http_allowlist_entry() {
        let legacy = legacy_allowed_url();
        let mut cfg = json!({ "allowedHttpHookUrls": ["https://example.com/*", legacy] });
        add_ours("claude", &mut cfg).unwrap();
        assert_eq!(cfg["allowedHttpHookUrls"], json!(["https://example.com/*"]));
        let mut cfg = json!({ "allowedHttpHookUrls": [legacy] });
        remove_ours(&mut cfg);
        assert_eq!(cfg, json!({ "allowedHttpHookUrls": [] }));
    }

    #[test]
    fn old_http_hooks_are_detected_and_replaced() {
        let old = json!({ "type": "http", "url": url("claude", "busy"), "timeout": 5 });
        let mut cfg = json!({ "hooks": { "UserPromptSubmit": [{ "hooks": [old] }] } });
        assert!(has_ours(&cfg));
        add_ours("claude", &mut cfg).unwrap();
        assert_eq!(cfg["hooks"]["UserPromptSubmit"].as_array().unwrap().len(), 1);
        assert_eq!(cfg["hooks"]["UserPromptSubmit"][0]["hooks"][0]["type"], "command");
        assert!(
            !has_ours(&json!({ "note": marker() })),
            "only entries under hooks count"
        );
    }

    #[test]
    fn login_shell_output_is_parsed() {
        let out = "motd noise\n__GHARS__CLAUDE_CONFIG_DIR=/x/claude\n__GHARS__CODEX_HOME=\n";
        let vars = parse_shell_vars(out, "__GHARS__");
        assert_eq!(vars.get("CLAUDE_CONFIG_DIR").map(String::as_str), Some("/x/claude"));
        assert!(!vars.contains_key("CODEX_HOME"));
    }
}
