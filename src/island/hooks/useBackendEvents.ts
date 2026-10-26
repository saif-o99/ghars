import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { applyConfig, autostarted, focusIsland, openSettings, type AgentEvent } from "../../shared/ipc";
import { nextPrayer } from "../../shared/prayer";
import { loadSettings, onSettingsChanged, type Settings } from "../../shared/settings";
import { loadStats, onStatsChanged } from "../../shared/stats";
import type { Anchor } from "../layout";
import type { Mode, PrayerNotice, View } from "../types";

type Setter<T> = Dispatch<SetStateAction<T>>;

/**
 * Loads the settings and stats, then follows what the backend and the settings window
 * report: settings, stats, the window's anchor, the AI agent, the hotkey.
 */
export function useBackendEvents({ settingsRef, viewRef, setSettings, setRev, setAnchor, setNow, setNotice, setView, setMode, modePicked }: {
  settingsRef: RefObject<Settings | null>;
  viewRef: RefObject<View>;
  setSettings: Setter<Settings | null>;
  setRev: Setter<number>;
  setAnchor: Setter<Anchor>;
  setNow: Setter<Date>;
  setNotice: Setter<PrayerNotice | null>;
  setView: Setter<View>;
  setMode: Setter<Mode>;
  modePicked: RefObject<boolean>;
}) {
  function autoOpen() {
    const s = settingsRef.current;
    if (!s || s.autoOpen === "off" || viewRef.current !== "collapsed") return;
    // Adhkar until the user picks a tab; after that, their tab stays.
    if (!modePicked.current) setMode("adhkar");
    setView(s.autoOpen === "full" ? "expanded" : "compact");
  }

  useEffect(() => {
    // Listeners are registered asynchronously; if the effect is cleaned up first
    // (StrictMode, hot reload), the late ones are removed as soon as they arrive.
    let cancelled = false;
    const unlisten: (() => void)[] = [];
    const keep = (p: Promise<() => void>) =>
      p.then((u) => (cancelled ? u() : unlisten.push(u))).catch((e) => console.error("Couldn't listen for events", e));
    (async () => {
      try {
        const [s] = await Promise.all([loadSettings(), loadStats()]);
        if (cancelled) return;
        setSettings(s);
        applyConfig(s).catch(console.error);
        invoke<Anchor>("island_anchor").then(setAnchor).catch(() => {});
        // The welcome window opens on a first launch, not when the system starts Ghars at login.
        if (!s.onboarded && !(await autostarted().catch(() => false))) openSettings().catch(console.error);
      } catch (e) {
        console.error("Couldn't load settings", e);
      }
    })();
    keep(
      onSettingsChanged((next) => {
        setSettings(next);
        applyConfig(next).catch(console.error);
      }),
    );
    keep(onStatsChanged(() => setRev((r) => r + 1)));
    keep(listen<Anchor>("island-anchor", (e) => setAnchor(e.payload)));
    keep(
      listen<AgentEvent>("agent", (e) => {
        if (e.payload.kind === "busy") autoOpen();
      }),
    );
    // Development only: the browser mock's ?notice= option shows a prayer note on demand.
    if (import.meta.env.DEV) {
      keep(
        listen<"now" | "soon">("test-prayer", (e) => {
          const s = settingsRef.current;
          const name = (s && nextPrayer(s.prayer, new Date())?.name) || "maghrib";
          setNow(new Date());
          setNotice({ name, time: new Date(Date.now() + (e.payload === "soon" ? 5 * 60_000 : -1000)) });
          if (viewRef.current === "collapsed") setView("compact");
        }),
      );
    }
    keep(
      listen<string>("hotkey", (e) => {
        if (e.payload === "toggle" && viewRef.current === "expanded") {
          setView("collapsed");
        } else {
          setView("expanded");
          focusIsland().catch(console.error);
        }
      }),
    );
    return () => {
      cancelled = true;
      unlisten.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load and subscribe once on mount; everything passed in is a state setter or ref
  }, []);
}
