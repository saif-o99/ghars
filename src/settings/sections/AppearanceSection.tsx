import { useEffect, useState } from "react";
import { fmt } from "../../i18n";
import { listMonitors, type MonitorInfo } from "../../shared/ipc";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Seg } from "../components/Seg";
import { ThemeGrid } from "../components/ThemeGrid";
import { Toggle } from "../components/Toggle";
import { WithPreview } from "../components/WithPreview";
import { Select } from "../Select";
import type { SectionProps } from "../types";

/** Linux can't move the window with the island, so the island stays on the top edge there. */
const linux = navigator.userAgent.includes("Linux");

export function AppearanceSection({ s, L, l, update }: SectionProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [slot, setSlot] = useState<"light" | "dark">("dark");
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  useEffect(() => void listMonitors().then(setMonitors).catch(() => {}), []);

  const system = s.themeMode === "system";
  const current = system ? (slot === "light" ? s.themeLight : s.themeDark) : s.theme;
  const pick = (id: string) => update(system ? (slot === "light" ? { themeLight: id } : { themeDark: id }) : { theme: id });
  const screens = [
    { value: "primary", label: l.screenPrimary },
    { value: "cursor", label: l.screenCursor },
    ...(monitors.length > 1
      ? monitors.map((m) => ({ value: String(m.index), label: fmt(l.screenN, { n: m.index + 1 }, s.uiLang), hint: `${m.width}×${m.height}` }))
      : []),
  ];

  return (
    <WithPreview s={s} L={L} themeId={hover ?? current}>
      <Group>
        <Row label={l.themeMode}>
          <Seg value={s.themeMode} label={l.themeMode} options={[["fixed", l.themeFixed], ["system", l.themeSystem]]} onChange={(v) => update({ themeMode: v })} />
        </Row>
        {system && (
          <Row label={l.themeFor}>
            <Seg value={slot} label={l.themeFor} options={[["light", l.light], ["dark", l.dark]]} onChange={setSlot} />
          </Row>
        )}
      </Group>
      <ThemeGrid value={current} lang={s.uiLang} onPick={pick} onHover={setHover} />

      <Group>
        <Row label={l.islandStyle} help={s.islandStyle === "notch" ? l.styleNotchHelp : undefined}>
          <Seg value={s.islandStyle} label={l.islandStyle} options={[["floating", l.styleFloating], ["notch", l.styleNotch]]} onChange={(v) => update({ islandStyle: v })} />
        </Row>
        <Row label={l.size}>
          <Seg value={s.islandSize} label={l.size} options={[["small", l.sizeSmall], ["normal", l.sizeNormal], ["large", l.sizeLarge]]} onChange={(v) => update({ islandSize: v })} />
        </Row>
        {!linux && (
          <Row label={l.edge}>
            {/* Left-to-right in every language, so "left" sits on the left. */}
            <div dir="ltr">
              <Seg value={s.islandEdge} label={l.edge} options={[["left", l.edgeLeft], ["top", l.edgeTop], ["right", l.edgeRight]]} onChange={(v) => update({ islandEdge: v })} />
            </div>
          </Row>
        )}
        <Row label={l.position} help={linux ? undefined : l.positionHelp}>
          <div dir="ltr"><Seg
            value={s.islandPos}
            label={l.position}
            options={
              s.islandEdge === "top" || linux
                ? [[0, l.alignLeft], [0.5, l.alignCenter], [1, l.alignRight]]
                : [[0, l.alignTop], [0.5, l.alignMiddle], [1, l.alignBottom]]
            }
            onChange={(v) => update({ islandPos: v })}
          /></div>
        </Row>
        <Row label={l.slim} help={l.slimHelp}>
          <Toggle label={l.slim} on={s.islandSlim} onChange={(v) => update({ islandSlim: v })} />
        </Row>
        <Row label={l.screen} help={l.screenHelp}>
          <Select width={210} value={s.islandMonitor} ariaLabel={l.screen} options={screens} onChange={(v) => update({ islandMonitor: v })} />
        </Row>
      </Group>

      <Group>
        <Row label={l.showTranslation}><Toggle label={l.showTranslation} on={s.showTranslation} onChange={(v) => update({ showTranslation: v })} /></Row>
        <Row label={l.showSource}><Toggle label={l.showSource} on={s.showSource} onChange={(v) => update({ showSource: v })} /></Row>
      </Group>
    </WithPreview>
  );
}
