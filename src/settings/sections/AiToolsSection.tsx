import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fmt } from "../../i18n";
import { installIntegration, integrations as fetchIntegrations, serverError, serverPort, simulateAgent, uninstallIntegration, type IntegrationStatus } from "../../shared/ipc";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Seg } from "../components/Seg";
import { withDetail } from "../errors";
import type { SectionProps } from "../types";

const TOOL_BADGES: Record<string, [string, string]> = {
  claude: ["C", "#c96442"],
  cursor: ["▲", "#2b2b2b"],
  codex: ["◎", "#10a37f"],
  gemini: ["✦", "#3b78e7"],
  copilot: ["✈︎", "#8250df"],
};

export function AiToolsSection({ s, l, update }: SectionProps) {
  const [list, setList] = useState<IntegrationStatus[]>([]);
  const [busyId, setBusyId] = useState("");
  const [err, setErr] = useState("");
  const [skill, setSkill] = useState<string[] | null>(null);
  const [port, setPort] = useState(47821);
  const [serverErr, setServerErr] = useState<string | null>(null);
  // Translated versions of the backend's per-tool notes.
  const notes: Record<string, string> = { codex: l.codexNote, copilot: l.copilotNote };

  const refresh = () => fetchIntegrations().then(setList).catch((e) => setErr(withDetail(l.toolsFailed, e)));
  useEffect(() => {
    refresh();
    serverPort().then(setPort).catch(() => {});
    serverError().then(setServerErr).catch(() => {});
    const un = listen("integrations-changed", refresh);
    return () => void un.then((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load and subscribe once on mount
  }, []);

  async function run(id: string, fn: (id: string) => Promise<IntegrationStatus>) {
    setBusyId(id);
    setErr("");
    try {
      await fn(id);
    } catch (e) {
      setErr(withDetail(l.toolsFailed, e));
    }
    setBusyId("");
    refresh();
  }

  return (
    <>
      {serverErr && (
        <div className="error" role="alert">
          {fmt(l.serverError, { port })} <code dir="ltr">{serverErr}</code>
        </div>
      )}
      <div className="tools">
        {list.map((t) => (
          <div key={t.id} className={`tool ${t.installed ? "is-on" : ""}`}>
            <span className="badge" style={{ background: TOOL_BADGES[t.id]?.[1] }} aria-hidden>{TOOL_BADGES[t.id]?.[0]}</span>
            <div className="t">
              <b>{t.name}</b>
              <small>{t.installed ? l.connected : t.detected ? l.detected : l.notDetected}</small>
              <code>{t.configPath}</code>
              {t.installed && t.note && <small className="note">{notes[t.id] ?? t.note}</small>}
            </div>
            {t.installed ? (
              <button disabled={busyId === t.id} onClick={() => run(t.id, uninstallIntegration)}>{l.disconnect}</button>
            ) : (
              <button className="primary" disabled={!t.detected || busyId === t.id} onClick={() => run(t.id, installIntegration)}>{l.connect}</button>
            )}
          </div>
        ))}
      </div>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="actions">
        <button className="primary" onClick={async () => { for (const t of list.filter((t) => t.detected && !t.installed)) await run(t.id, installIntegration); }}>
          {l.connectAll}
        </button>
        <button onClick={() => simulateAgent("busy").catch((e) => setErr(withDetail(l.actionFailed, e)))}>{l.testBusy}</button>
        <button onClick={() => simulateAgent("idle").catch((e) => setErr(withDetail(l.actionFailed, e)))}>{l.testIdle}</button>
      </div>

      <Group>
        <Row label={l.autoOpen}>
          <Seg value={s.autoOpen} label={l.autoOpen} options={[["compact", l.autoCompact], ["full", l.autoFull], ["off", l.autoOff]]} onChange={(v) => update({ autoOpen: v })} />
        </Row>
      </Group>

      <div className="gtitle">{l.skill}</div>
      <div className="group steps">
        <p>{l.skillWhy}</p>
        <ol>
          <li>{l.skillStep1}</li>
          <li>{l.skillStep2}</li>
          <li>{l.skillStep3}</li>
        </ol>
        <button onClick={() => invoke<string[]>("install_skill").then(setSkill).catch((e) => setErr(withDetail(l.skillFailed, e)))}>{l.installSkill}</button>
        {skill && (
          <div className="help">
            {l.skillDone}
            {skill.map((p) => <code key={p}>{p}</code>)}
          </div>
        )}
      </div>

      <details className="advanced">
        <summary>{l.advanced}</summary>
        <div className="apps">
          <label>{l.api}</label>
          <small className="help">{l.apiHelp}</small>
          <pre dir="ltr">{`curl -X POST http://127.0.0.1:${port}/v1/busy
npm run build
curl -X POST http://127.0.0.1:${port}/v1/idle`}</pre>
        </div>
      </details>
    </>
  );
}
