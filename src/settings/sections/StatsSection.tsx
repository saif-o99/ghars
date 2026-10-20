import { useEffect, useState, type CSSProperties } from "react";
import { ISTIGHFAR, PACKS } from "../../shared/content";
import { fmt } from "../../i18n";
import { exportBackup, importBackup } from "../../shared/ipc";
import { allDays, clearStats, dayKey, importDays, lastDays, loadStats, onStatsChanged } from "../../shared/stats";
import { Group } from "../components/Group";
import { Seg } from "../components/Seg";
import { withDetail } from "../errors";
import type { SectionProps } from "../types";

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d)));
  return cells;
}

export function StatsSection({ s, l }: SectionProps) {
  const [rev, setRev] = useState(0);
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  void rev;
  // The island saves counts as you go: read them again when this page opens, then follow along.
  useEffect(() => {
    loadStats()
      .then(() => setRev((r) => r + 1))
      .catch(console.error);
    const un = onStatsChanged(() => setRev((r) => r + 1));
    return () => void un.then((u) => u());
  }, []);

  const all = allDays();
  const week = lastDays(7);
  const todayCounts = all[dayKey()] ?? {};
  const allItems = [ISTIGHFAR.short, ISTIGHFAR.tawba, ...Object.values(PACKS).flatMap((p) => p.items), ...s.customAdhkar.map((c) => ({ id: c.id, ar: c.ar }))];
  const label = (id: string) => allItems.find((d) => d.id === id)?.ar ?? id;
  const totalOf = (key: string) => Object.values(all[key] ?? {}).reduce((a, b) => a + b, 0);
  const cells = monthGrid(month.y, month.m);
  const monthMax = Math.max(1, ...cells.map((k) => (k ? totalOf(k) : 0)));
  const weekMax = Math.max(1, ...week.map((d) => d.total));
  const monthName = new Date(month.y, month.m, 1).toLocaleDateString(s.uiLang, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(s.uiLang, { weekday: "narrow" }));
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  async function exportFile() {
    setMsg("");
    try {
      // Read the file again so counts saved by the island a moment ago are included.
      const days = await loadStats();
      setRev((r) => r + 1);
      await exportBackup(`ghars-backup-${dayKey()}.json`, JSON.stringify({ app: "ghars", version: 1, days }, null, 2));
    } catch (e) {
      setMsg(withDetail(l.exportFailed, e));
    }
  }

  async function importFile() {
    setMsg("");
    let text: string | null;
    try {
      text = await importBackup();
    } catch (e) {
      return setMsg(withDetail(l.importFailed, e));
    }
    if (text === null) return;
    const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return setMsg(l.importInvalid);
    }
    // A backup ({ app, version, days }) or just the days.
    const days = isObject(data) && "days" in data ? data.days : data;
    if (!isObject(days)) return setMsg(l.importInvalid);
    try {
      const n = await importDays(days);
      setMsg(fmt(l.imported, { n }, s.uiLang));
    } catch (e) {
      setMsg(withDetail(l.importFailed, e));
    }
    setRev((r) => r + 1);
  }

  return (
    <>
      <h2>{l.today}</h2>
      <div className="today">
        {Object.entries(todayCounts).length === 0 && <span className="help">—</span>}
        {Object.entries(todayCounts).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
          <div key={id} className="today-row">
            <span className="ar" lang="ar">{label(id)}</span>
            <b>{n}</b>
          </div>
        ))}
      </div>

      <div className="stats-head">
        <Seg value={view} label={l.statsRange} options={[["week", l.week], ["month", l.month]]} onChange={setView} />
        {view === "month" && (
          <div className="month-nav" dir="ltr">
            <button aria-label={l.prevMonth} onClick={() => shift(-1)}>‹</button>
            <b>{monthName}</b>
            <button aria-label={l.nextMonth} onClick={() => shift(1)}>›</button>
          </div>
        )}
      </div>

      {view === "week" ? (
        <div className="bars" dir="ltr">
          {week.map((d) => (
            <div key={d.key} className="bar">
              <i style={{ height: `${(d.total / weekMax) * 100}%` }} />
              <b>{d.total}</b>
              <small>{new Date(d.key + "T12:00").toLocaleDateString(s.uiLang, { weekday: "short" })}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar" dir="ltr">
          {weekdays.map((w, i) => <span key={i} className="wd">{w}</span>)}
          {cells.map((key, i) =>
            key ? (
              <div
                key={key}
                className={`day${key === dayKey() ? " today-cell" : ""}`}
                style={{ "--v": totalOf(key) / monthMax } as CSSProperties}
                title={`${key}: ${totalOf(key)}`}
              >
                <small>{Number(key.slice(8))}</small>
                {totalOf(key) > 0 && <b>{totalOf(key)}</b>}
              </div>
            ) : (
              <span key={`x${i}`} />
            ),
          )}
        </div>
      )}

      <Group title={l.backup}>
        <div className="row">
          <div className="actions-inline wrap-ok">
            <button onClick={exportFile}>{l.exportJson}</button>
            <button onClick={importFile}>{l.importBackup}</button>
          </div>
          <button
            className="danger"
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              setConfirm(false);
              try {
                await clearStats();
              } catch (e) {
                setMsg(withDetail(l.actionFailed, e));
              }
              setRev((r) => r + 1);
            }}
          >
            {confirm ? l.resetConfirm : l.reset}
          </button>
        </div>
      </Group>
      {msg && <p className="help" role="status">{msg}</p>}
    </>
  );
}
