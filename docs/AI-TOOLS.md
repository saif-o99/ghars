# Ghars and your AI tools

When your AI coding agent starts working, Ghars opens by itself with adhkar (or the tab you last
picked), so the waiting time becomes remembrance. It never closes on its own: move the mouse over
it and away, press Esc, or click ×.

It works with **Claude Code, Cursor, Codex CLI, Gemini CLI and GitHub Copilot** (Copilot CLI and
agent mode in VS Code).

## Two ways to connect

### 1. From Settings

Open **Settings → AI tools**. Ghars lists the tools it finds on your computer. Click **Connect**
next to each one, or **Connect all detected tools**.

### 2. Let your agent do it

In **Settings → AI tools**, click **Install skill**. Then ask your agent:

> Set up Ghars

The agent connects itself and checks that the island opens.
(The skill lives in [`skills/ghars-setup`](../skills/ghars-setup/SKILL.md).)

## Good to know

- **Codex** asks you to trust new hooks once. In Codex, run `/hooks` and approve the Ghars entries.
  Until then, Settings shows a reminder.
- **Copilot CLI** picks up the connection after you restart it.
- **Disconnect** removes only what Ghars added. Your own settings stay as they are.
- The first time Ghars changes a file, it keeps a copy next to it, ending in `.ghars.bak`.
- If Ghars isn't running, your tools keep working normally, without errors.
- Your prompts and code are never sent to Ghars. It only learns that the agent started or stopped.

## What Ghars changes

Connecting adds a small "hook" to the tool's settings file. A hook tells Ghars when the agent
starts and stops working.

| Tool | File |
|---|---|
| Claude Code | `~/.claude/settings.json` |
| Cursor | `~/.cursor/hooks.json` |
| Codex CLI | `~/.codex/hooks.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| GitHub Copilot | `~/.copilot/hooks/ghars.json`, a file of Ghars's own (in `$COPILOT_HOME/hooks/` if that's set) |
