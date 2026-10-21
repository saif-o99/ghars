// Lets the UI run in a normal browser during development (`pnpm dev`, then open
// http://localhost:1437/ or /settings.html). It fakes the Tauri backend in memory.
// URL options: ?theme=clay  ?lang=en  ?prayer=1  ?onboarded=0  ?servererr=msg  ?style=notch  ?size=large  ?align=left
//   ?update=1.2.3 (an update is available)  ?updateerr=msg (checking fails)  ?mac=1 (macOS title bar)
//   ?section=2 (opens that sidebar page)
// From the console: __ghars.agent("busy" | "idle" | "attention"), __ghars.waiting(), __ghars.hotkey(),
//   __ghars.updateAvailable("1.2.3")
// URL options for the island: ?edge=left|right, ?notice=now|soon, ?open=1 (opens it), ?tab=adhkar, ?pack=general,
//   ?count=33 (today's count for every dhikr)
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { PACKS } from "../shared/content";
import { DEFAULT_SETTINGS, type Settings } from "../shared/settings";

const params = new URLSearchParams(location.search);
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  theme: params.get("theme") ?? DEFAULT_SETTINGS.theme,
  uiLang: (params.get("lang") as Settings["uiLang"]) ?? "en",
  islandStyle: params.get("style") === "notch" ? "notch" : "floating",
  islandSize: (params.get("size") as Settings["islandSize"]) ?? "normal",
  islandPos: params.get("align") === "left" ? 0 : params.get("align") === "right" ? 1 : 0.5,
  onboarded: params.get("onboarded") !== "0",
  packMode: (params.get("pack") as Settings["packMode"]) ?? DEFAULT_SETTINGS.packMode,
  prayer: params.get("prayer")
    ? { ...DEFAULT_SETTINGS.prayer, enabled: true, lat: 31.9539, lng: 35.9106, label: "Amman", cityId: "amman" }
    : DEFAULT_SETTINGS.prayer,
};

const stores: Record<number, Map<string, unknown>> = {
  1: new Map<string, unknown>([["settings", settings]]),
  2: new Map<string, unknown>(),
};
if (params.get("count")) {
  const n = Number(params.get("count"));
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Every adhkar item gets the same count too, kept below its target so it isn't marked done.
  const counts: Record<string, number> = { istighfar: n };
  for (const pack of Object.values(PACKS)) for (const item of pack.items) counts[item.id] = Math.min(n, item.target - 1);
  stores[2].set("days", { [day]: counts });
}
const status = { busy: false, attention: false, sources: [] as string[] };

const updateInfo = (version: string) => ({
  version,
  notes: "- Prayer times: choose the high-latitude rule\n- Umm al-Qura: Isha two hours after Maghrib in Ramadan\n- Updates from inside the app",
  date: new Date().toISOString(),
});
let update = params.get("update") ? updateInfo(params.get("update")!) : null;

/** Pretends to download about 8 MB in a couple of seconds, then "restarts". */
async function installUpdate() {
  const total = 8_000_000;
  for (let downloaded = 0; downloaded <= total; downloaded += 800_000) {
    await emit("update-progress", { downloaded, total });
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 600));
  location.reload();
}

const integrations = [
  { id: "claude", name: "Claude Code", detected: true, installed: true, configPath: "~/.claude/settings.json", note: "", needsApproval: false },
  { id: "cursor", name: "Cursor", detected: true, installed: false, configPath: "~/.cursor/hooks.json", note: "", needsApproval: false },
  { id: "codex", name: "Codex CLI", detected: false, installed: false, configPath: "~/.codex/hooks.json", note: "", needsApproval: false },
  { id: "gemini", name: "Gemini CLI", detected: false, installed: false, configPath: "~/.gemini/settings.json", note: "", needsApproval: false },
  { id: "copilot", name: "GitHub Copilot", detected: true, installed: false, configPath: "~/.copilot/hooks/ghars.json", note: "Copilot CLI and Copilot agent mode in VS Code both use these hooks. Restart Copilot CLI to load them.", needsApproval: false },
];

mockWindows(location.pathname.includes("settings") ? "settings" : "island");
mockIPC(
  (cmd, args) => {
    const a = (args ?? {}) as Record<string, unknown>;
    switch (cmd) {
      case "plugin:store|load":
        return String(a.path).startsWith("stats") ? 2 : 1;
      case "plugin:store|get": {
        const store = stores[a.rid as number];
        return [store.get(a.key as string) ?? null, store.has(a.key as string)];
      }
      case "plugin:store|set":
        stores[a.rid as number].set(a.key as string, a.value);
        return null;
      case "integrations_status":
        return integrations;
      case "integration_install":
      case "integration_uninstall": {
        const t = integrations.find((i) => i.id === a.id)!;
        t.installed = cmd === "integration_install";
        return t;
      }
      case "install_skill":
        return ["~/.claude/skills/ghars-setup/SKILL.md", "~/.agents/skills/ghars-setup/SKILL.md"];
      case "plugin:autostart|is_enabled":
      case "autostarted":
        return false;
      case "server_port":
        return 47821;
      case "server_error":
        return params.get("servererr");
      case "list_monitors":
        return [];
      case "island_anchor":
        // ?edge=left|right puts the island on a side of the screen.
        return params.get("edge") === "left"
          ? { edge: "left", x: 0, y: 260 }
          : params.get("edge") === "right"
            ? { edge: "right", x: 600, y: 260 }
            : { edge: "top", x: 300, y: 0 };
      case "check_update":
        return new Promise((resolve, reject) =>
          setTimeout(() => (params.get("updateerr") ? reject(params.get("updateerr")) : resolve(update)), 800),
        );
      case "pending_update":
        return update;
      case "install_update":
        return installUpdate();
      default:
        return null;
    }
  },
  { shouldMockEvents: true },
);

async function agent(kind: "busy" | "idle" | "attention") {
  status.busy = kind === "busy";
  status.attention = kind === "attention";
  status.sources = kind === "idle" ? [] : ["claude"];
  await emit("agent", { kind, source: "claude", ...status });
}

// ?notice=now|soon shows a prayer note shortly after the island loads.
if (params.get("notice")) setTimeout(() => void emit("test-prayer", params.get("notice") === "soon" ? "soon" : "now"), 1200);
// ?open=1 opens the island as the hotkey would, for screenshots.
if (params.get("open")) setTimeout(() => void emit("hotkey", "toggle"), 800);
// ?tab=adhkar switches to the adhkar once the island has finished opening.
if (params.get("tab") === "adhkar") setTimeout(() => document.querySelectorAll<HTMLButtonElement>("button.tab")[1]?.click(), 2500);
// ?section=3 opens the settings page at that position in the sidebar (0 = the first).
if (params.get("section"))
  setTimeout(() => document.querySelectorAll<HTMLButtonElement>("nav button")[Number(params.get("section"))]?.click(), 800);

Object.assign(window, {
  __ghars: {
    agent,
    waiting: () => emit("likely-waiting"),
    hotkey: () => emit("hotkey", "toggle"),
    updateAvailable: (version = "1.2.3") => {
      update = updateInfo(version);
      return emit("update-available", update);
    },
  },
});
