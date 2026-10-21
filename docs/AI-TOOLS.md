# Ghars and your AI tools

Ghars opens by itself while your AI coding agent is working, so the waiting time becomes
remembrance. It never closes on its own: move the mouse over it and away, press Esc, or click ×.

## Connect

**Settings → AI tools → Connect.** Ghars adds hooks to the tool's user config and only touches
entries pointing at its own local URL. The first time it changes a file it keeps a
`<file>.ghars.bak` copy. **Disconnect** removes only Ghars's own hooks, never yours, even when they
share a group. The hooks always exit successfully, so your tools don't report an error while Ghars
isn't running, and after an update Ghars upgrades the hooks it installed on its first launch.
If another program holds port 47821, Settings → AI tools shows a warning.

| Tool | Config file | Notes |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | Command hook (`curl`); your prompt is never sent to Ghars |
| Cursor | `~/.cursor/hooks.json` | |
| Codex CLI | `~/.codex/hooks.json` | Codex asks you to trust new hooks once: run `/hooks` and approve the Ghars entries |
| Gemini CLI | `~/.gemini/settings.json` | |
| GitHub Copilot | `~/.copilot/hooks/ghars.json` (`$COPILOT_HOME/hooks/` if set) | A file of Ghars's own, deleted on Disconnect. Read by Copilot CLI (restart it after connecting) and by Copilot agent mode in VS Code, which always looks in `~/.copilot/hooks` |

Prefer to let your agent do it? Install the bundled **ghars-setup** skill (Settings → AI tools →
Install skill) and ask your agent to "set up Ghars". The skill lives in [`skills/ghars-setup`](../skills/ghars-setup/SKILL.md).

## Local API

Ghars listens on `127.0.0.1:47821` only. This is its only network use besides the daily update
check. Anything can tell it you're waiting:

```sh
curl -X POST http://127.0.0.1:47821/v1/busy   # island opens with adhkar
npm run build
curl -X POST http://127.0.0.1:47821/v1/idle
```

| Endpoint | |
|---|---|
| `POST /v1/event/{source}/{busy\|idle\|attention\|end}` | Used by hooks; the body may contain the tool's `session_id` |
| `POST /v1/busy`, `/v1/idle`, `/v1/attention` | For scripts (`?session=` optional) |
| `GET /v1/status` | `{ busy, attention, sources }` |
| `GET /health` | `200` while Ghars is running (used by the setup skill) |
| `GET /v1/integrations`, `POST /v1/setup` | Used by the setup skill (`POST` needs header `X-Ghars: 1`) |

Requests from web pages (anything sending an `Origin` header, or a `Host` other than `127.0.0.1` /
`localhost`) are rejected.
