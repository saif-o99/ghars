import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { fmt } from "../../i18n";
import { applyConfig, islandPaused, pauseIsland } from "../../shared/ipc";
import { DEFAULT_HOTKEY } from "../../shared/settings";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Toggle } from "../components/Toggle";
import { withDetail } from "../errors";
import type { SectionProps } from "../types";

export function BehaviorSection({ s, l, update, setError }: SectionProps & { setError: (e: string) => void }) {
  const [auto, setAuto] = useState<boolean | null>(null);
  const [hotkey, setHotkey] = useState(s.hotkey);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    autostartEnabled().then(setAuto).catch(() => setAuto(false));
    islandPaused().then(setPaused).catch(() => {});
    const un = listen<boolean>("pause-changed", (e) => setPaused(e.payload));
    return () => void un.then((u) => u());
  }, []);
  const pause = (m: number | null) =>
    pauseIsland(m)
      .then(() => islandPaused().then(setPaused))
      .catch((e) => setError(withDetail(l.actionFailed, e)));

  return (
    <>
      <Group>
        <Row label={l.autostart}>
          {auto !== null && (
            <Toggle
              label={l.autostart}
              on={auto}
              onChange={async (v) => {
                try {
                  await (v ? enableAutostart() : disableAutostart());
                } catch (e) {
                  setError(withDetail(l.actionFailed, e));
                }
                setAuto(await autostartEnabled().catch(() => !v));
              }}
            />
          )}
        </Row>
        <Row label={l.hideFullscreen}><Toggle label={l.hideFullscreen} on={s.hideInFullscreen} onChange={(v) => update({ hideInFullscreen: v })} /></Row>
        <Row label={l.hotkey} help={fmt(l.hotkeyHelp, { key: DEFAULT_HOTKEY })}>
          <input
            dir="ltr"
            value={hotkey}
            aria-label={l.hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            onBlur={async () => {
              if (hotkey === s.hotkey) return;
              // Registering it first checks that the shortcut is valid and free.
              try {
                await applyConfig({ ...s, hotkey });
              } catch (e) {
                setError(withDetail(l.hotkeyFailed, e));
                return;
              }
              // Saves only the hotkey, merged into the latest settings.
              await update({ hotkey });
            }}
          />
        </Row>
      </Group>

      <Group>
        <Row label={paused ? `${l.pause} · ${l.paused}` : l.pause} help={l.pauseHelp}>
          {paused ? (
            <button className="primary" onClick={() => pause(0)}>{l.resume}</button>
          ) : (
            <div className="actions-inline">
              <button onClick={() => pause(30)}>{l.pause30}</button>
              <button onClick={() => pause(60)}>{l.pause60}</button>
              <button onClick={() => pause(180)}>{l.pause180}</button>
              <button onClick={() => pause(null)}>{l.pauseForever}</button>
            </div>
          )}
        </Row>
        <Row label={l.quiet} help={l.quietHelp}>
          <Toggle label={l.quiet} on={s.quiet.enabled} onChange={(v) => update({ quiet: { ...s.quiet, enabled: v } })} />
        </Row>
        {s.quiet.enabled && (
          <Row label={`${l.from} – ${l.to}`}>
            <div className="pair">
              <input type="time" value={s.quiet.from} aria-label={l.from} onChange={(e) => update({ quiet: { ...s.quiet, from: e.target.value } })} />
              <input type="time" value={s.quiet.to} aria-label={l.to} onChange={(e) => update({ quiet: { ...s.quiet, to: e.target.value } })} />
            </div>
          </Row>
        )}
      </Group>
    </>
  );
}
