---
name: ghars-setup
description: Connect AI coding tools (Claude Code, Cursor, Codex CLI, Gemini CLI, GitHub Copilot CLI and VS Code agent mode) to Ghars, the open-source istighfar/adhkar island, so it opens automatically while the agent is working. Use when the user asks to set up, connect, test, or troubleshoot Ghars.
---

# Ghars setup

Ghars is a desktop app that shows an istighfar/adhkar counter at the top of the screen. It listens on
`http://127.0.0.1:47821` and opens its island when an AI tool reports "busy". This skill wires the
user's AI tools to that listener. Everything stays on the local machine.

On Windows PowerShell always call `curl.exe` (plain `curl` is an alias for `Invoke-WebRequest`).

## 1. Make sure Ghars is running

```sh
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:47821/health
```

`200` means it is running. Anything else: ask the user to start Ghars (it lives in the system
tray / menu bar) and try again. Do not continue until it answers.

## 2. Connect every detected tool

Ask Ghars to write the hooks itself. It only touches tools whose config folder exists, keeps a
`.ghars.bak` backup of each file it changes, and never modifies the user's other hooks.

```sh
curl -s -X POST -H "X-Ghars: 1" http://127.0.0.1:47821/v1/setup
```

The response is a JSON list of `{ id, name, detected, installed, configPath, note }`. Report to the
user which tools are now connected and the config file for each. Show any `note` verbatim.

- **Codex CLI**: new hooks are skipped until trusted. Tell the user to run `/hooks` inside Codex once
  and trust the Ghars entries.
- **GitHub Copilot**: Ghars writes its own file, `~/.copilot/hooks/ghars.json` (`$COPILOT_HOME/hooks/`
  if set). Copilot CLI loads hooks at startup, so tell the user to restart it. Copilot agent mode in
  VS Code reads the same folder (`~/.copilot/hooks`) by itself.
- If an entry has `installed: false` and a note about comments/JSON, the file has comments that Ghars
  won't rewrite. Offer to add the hooks by hand using the snippets below.

## 3. Test it

```sh
curl -s -X POST http://127.0.0.1:47821/v1/busy
```

The island should open with adhkar. Then:

```sh
curl -s -X POST http://127.0.0.1:47821/v1/idle
```

## Manual snippets (only if step 2 can't be used)

Every hook is a command that pings Ghars without sending anything else and always exits 0, even
when Ghars isn't running:

- macOS / Linux: `curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/<tool>/<kind> || true`
- Windows (Claude Code, Cursor, Gemini CLI, Copilot's `powershell` field): `curl.exe -s -m 2 -o NUL -X POST http://127.0.0.1:47821/v1/event/<tool>/<kind>; exit 0`
- Windows (Codex CLI): `powershell -NoProfile -Command "curl.exe -s -m 2 -o NUL -X POST http://127.0.0.1:47821/v1/event/codex/<kind>; exit 0"`

`<tool>` is `claude`, `cursor`, `codex`, `gemini` or `copilot`; `<kind>` is `busy`, `idle`, `attention` or `end`.

Claude Code (`~/.claude/settings.json`, merge into `hooks`; macOS / Linux commands shown):

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/claude/busy || true", "timeout": 5 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/claude/idle || true", "timeout": 5 }] }],
    "Notification": [
      { "matcher": "permission_prompt", "hooks": [{ "type": "command", "command": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/claude/attention || true", "timeout": 5 }] },
      { "matcher": "idle_prompt", "hooks": [{ "type": "command", "command": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/claude/idle || true", "timeout": 5 }] }
    ],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/claude/end || true", "timeout": 5 }] }]
  }
}
```

Other tools use the same command with their own name in the URL. Events to map:

| Tool | busy | idle | attention | end |
|---|---|---|---|---|
| Cursor (`~/.cursor/hooks.json`, needs `"version": 1`) | `beforeSubmitPrompt` | `stop` | – | `sessionEnd` |
| Codex (`~/.codex/hooks.json`) | `UserPromptSubmit` | `Stop`, `Interrupt` | `PermissionRequest` | `SessionEnd` |
| Gemini CLI (`~/.gemini/settings.json`) | `BeforeAgent` | `AfterAgent` | `Notification` | `SessionEnd` |
| GitHub Copilot (`~/.copilot/hooks/ghars.json`, see below) | `userPromptSubmitted` | `agentStop` | `notification` | `sessionEnd` |

Gemini CLI treats unexpected exit codes as "deny", so never drop the `|| true` / `exit 0`.

GitHub Copilot uses its own file in `~/.copilot/hooks/` (any `*.json` there is loaded; `$COPILOT_HOME/hooks/`
if set) with flat hook objects. Give every hook both fields: Copilot runs `bash` on macOS / Linux and
`powershell` on Windows. Copilot CLI and VS Code agent mode both read this folder (VS Code ignores
`notification`). Busy hook shown; the others follow the table above:

```json
{
  "version": 1,
  "hooks": {
    "userPromptSubmitted": [{
      "type": "command",
      "bash": "curl -s -m 2 -o /dev/null -X POST http://127.0.0.1:47821/v1/event/copilot/busy || true",
      "powershell": "curl.exe -s -m 2 -o NUL -X POST http://127.0.0.1:47821/v1/event/copilot/busy; exit 0",
      "timeoutSec": 5
    }]
  }
}
```

For `notification`, add `"matcher": "permission_prompt|elicitation_dialog"` so only permission and
question prompts count as attention.

## Removing

The user can disconnect any tool from Ghars → Settings → AI tools. That removes only the entries
pointing at `127.0.0.1:47821`.
