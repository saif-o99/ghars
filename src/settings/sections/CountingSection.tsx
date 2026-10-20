import { useState } from "react";
import { ISTIGHFAR, PACK_ORDER, type CustomDhikr, type PackId } from "../../shared/content";
import { CountInput } from "../components/CountInput";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Seg } from "../components/Seg";
import { Toggle } from "../components/Toggle";
import { Select } from "../Select";
import type { SectionProps } from "../types";

export function CountingSection({ s, L, l, update }: SectionProps) {
  const packIds = PACK_ORDER.filter((p) => p !== "custom" || s.customAdhkar.length > 0);
  const packOptions: ["auto" | PackId, string][] = [["auto", l.packAuto], ...packIds.map((p) => [p, L.packs[p]] as [PackId, string])];
  return (
    <>
      <Group>
        <Row label={l.istighfarPhrase}>
          <Seg value={s.istighfarPhrase} label={l.istighfarPhrase} options={[["short", ISTIGHFAR.short.ar], ["tawba", ISTIGHFAR.tawba.ar]]} onChange={(v) => update({ istighfarPhrase: v })} />
        </Row>
        <Row label={l.goal}>
          <CountInput value={s.istighfarGoal} label={l.goal} onCommit={(n) => update({ istighfarGoal: n })} />
        </Row>
        <Row label={l.pack}>
          <Select
            // An emptied "My adhkar" set shows the general one, as the island does.
            value={s.packMode === "custom" && !s.customAdhkar.length ? "general" : s.packMode}
            ariaLabel={l.pack}
            options={packOptions.map(([value, label]) => ({ value, label }))}
            onChange={(v) => update({ packMode: v })}
          />
        </Row>
        <Row label={l.sound}><Toggle label={l.sound} on={s.sound} onChange={(v) => update({ sound: v })} /></Row>
      </Group>
      <MyAdhkar s={s} l={l} update={update} />
    </>
  );
}

const emptyDhikr = (): CustomDhikr => ({ id: `c-${Date.now().toString(36)}`, ar: "", meaning: "", source: "", target: 33 });

function MyAdhkar({ s, l, update }: Pick<SectionProps, "s" | "l" | "update">) {
  const [draft, setDraft] = useState<CustomDhikr | null>(null);
  const list = s.customAdhkar;
  const save = () => {
    if (!draft || !draft.ar.trim()) return;
    const exists = list.some((d) => d.id === draft.id);
    const clean = { ...draft, ar: draft.ar.trim(), meaning: draft.meaning.trim(), source: draft.source.trim(), target: Math.min(10_000, Math.max(1, Math.round(draft.target) || 1)) };
    update({ customAdhkar: exists ? list.map((d) => (d.id === draft.id ? clean : d)) : [...list, clean] });
    setDraft(null);
  };

  return (
    <>
      <div className="gtitle">{l.myAdhkar}</div>
      <p className="help">{l.myAdhkarHelp}</p>
      <div className="group">
        {list.length === 0 && !draft && <div className="row empty">{l.noCustom}</div>}
        {list.map((d) =>
          draft?.id === d.id ? null : (
            <div className="row dhikr-row" key={d.id}>
              <div className="row-label">
                <span className="dhikr-ar" lang="ar">{d.ar}</span>
                {(d.meaning || d.source) && <small>{[d.meaning, d.source].filter(Boolean).join(" · ")}</small>}
              </div>
              <div className="row-control actions-inline">
                <span className="pillnum">×{d.target}</span>
                <button onClick={() => setDraft({ ...d })}>{l.edit}</button>
                <button className="danger" onClick={() => update({ customAdhkar: list.filter((x) => x.id !== d.id) })}>{l.remove}</button>
              </div>
            </div>
          ),
        )}
        {draft && (
          <div className="dhikr-form">
            <label>
              {l.dhikrText}
              <textarea dir="rtl" lang="ar" rows={2} value={draft.ar} onChange={(e) => setDraft({ ...draft, ar: e.target.value })} autoFocus />
            </label>
            <label>
              {l.dhikrMeaning}
              <input value={draft.meaning} onChange={(e) => setDraft({ ...draft, meaning: e.target.value })} />
            </label>
            <div className="form-pair">
              <label>
                {l.dhikrTarget}
                <CountInput value={draft.target} onCommit={(n) => setDraft({ ...draft, target: n })} />
              </label>
              <label>
                {l.dhikrSource}
                <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
              </label>
            </div>
            <div className="actions">
              <button className="primary" disabled={!draft.ar.trim()} onClick={save}>{l.save}</button>
              <button onClick={() => setDraft(null)}>{l.cancel}</button>
            </div>
          </div>
        )}
      </div>
      {!draft && <button onClick={() => setDraft(emptyDhikr())}>+ {l.addDhikr}</button>}
    </>
  );
}
