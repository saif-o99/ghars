import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fmt, type Lang } from "../../i18n";
import { checkUpdate, installUpdate, pendingUpdate, type UpdateInfo, type UpdateProgress } from "../../shared/ipc";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Toggle } from "../components/Toggle";
import { withDetail } from "../errors";
import type { SectionProps } from "../types";

// The settings capability lets the opener plugin open only these two.
const AUTHOR_URL = "https://github.com/saif-o99";
const ISSUES_URL = "https://github.com/saif-o99/ghars/issues";

/** A web link that opens in the default browser rather than in the settings window. */
function Link({ url }: { url: string }) {
  return (
    <a
      href={url}
      dir="ltr"
      onClick={(e) => {
        e.preventDefault();
        openUrl(url).catch(console.error);
      }}
    >
      {url.replace("https://", "")}
    </a>
  );
}

/** The release date of an update in the interface language, if the backend sent a readable one. */
function releaseDate(date: string | null | undefined, lang: Lang): string {
  const d = date ? new Date(date) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }) : "";
}

/** "45%" while the size is known, otherwise how much has arrived ("3.2 MB"). */
function downloadProgress(p: UpdateProgress, lang: Lang): string {
  if (p.total) return new Intl.NumberFormat(lang, { style: "percent" }).format(Math.min(1, p.downloaded / p.total));
  return new Intl.NumberFormat(lang, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(p.downloaded / 1_000_000);
}

export function AboutSection({ s, l, update }: SectionProps) {
  const [check, setCheck] = useState<"idle" | "checking" | "latest" | "error">("idle");
  const [checkErr, setCheckErr] = useState("");
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [installErr, setInstallErr] = useState("");

  useEffect(() => {
    // An update the automatic check already found, and any found while this page is open.
    pendingUpdate().then((u) => u && setAvailable(u)).catch(() => {});
    const unAvailable = listen<UpdateInfo>("update-available", (e) => setAvailable(e.payload));
    const unProgress = listen<UpdateProgress>("update-progress", (e) => setProgress(e.payload));
    // Also covers installs started from the tray menu.
    const unError = listen<string>("update-error", (e) => {
      setInstalling(false);
      setProgress(null);
      setInstallErr(withDetail(l.updateFailed, e.payload));
    });
    return () => {
      void unAvailable.then((u) => u());
      void unProgress.then((u) => u());
      void unError.then((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once on mount
  }, []);

  async function checkNow() {
    setCheck("checking");
    setCheckErr("");
    try {
      const u = await checkUpdate();
      setAvailable(u);
      setCheck(u ? "idle" : "latest");
    } catch (e) {
      setCheck("error");
      setCheckErr(withDetail(l.updateCheckFailed, e));
    }
  }

  async function install() {
    setInstalling(true);
    setInstallErr("");
    setProgress(null);
    try {
      // On success the app restarts, so this page goes away.
      await installUpdate();
    } catch (e) {
      setInstalling(false);
      setInstallErr(withDetail(l.updateFailed, e));
    }
  }

  // A found update has its own card below.
  const status = check === "checking" ? l.updateChecking : check === "latest" ? l.upToDate : undefined;
  const date = releaseDate(available?.date, s.uiLang);
  const notes = available?.notes?.trim();
  const installStatus = !progress
    ? l.updateInstalling
    : progress.total && progress.downloaded >= progress.total
      ? l.updateInstalling
      : fmt(l.updateDownloading, { progress: downloadProgress(progress, s.uiLang) });

  return (
    <>
      <Group>
        <Row label={l.version}>
          <span className="version" dir="ltr">v{__APP_VERSION__}</span>
        </Row>
        <Row label={l.checkUpdates} help={l.checkUpdatesHelp}>
          <Toggle label={l.checkUpdates} on={s.checkUpdates} onChange={(v) => update({ checkUpdates: v })} />
        </Row>
        <Row label={l.updates} help={status}>
          <button disabled={check === "checking" || installing} onClick={checkNow}>{l.checkNow}</button>
        </Row>
        {available && (
          <div className="update">
            <div className="update-head">
              <b>{fmt(l.updateAvailable, { version: available.version })}</b>
              {date && <small>{date}</small>}
            </div>
            {notes && (
              <>
                <small className="update-notes-title">{l.updateNotes}</small>
                {/* Release notes are written in English. */}
                <div className="update-notes" dir="ltr" lang="en">{notes}</div>
              </>
            )}
            {installing ? (
              <div className="update-progress" role="status">
                <div className="progress-bar" aria-hidden>
                  <i
                    className={progress?.total ? "" : "indeterminate"}
                    style={progress?.total ? { width: `${Math.min(100, (progress.downloaded / progress.total) * 100)}%` } : undefined}
                  />
                </div>
                <small>{installStatus}</small>
              </div>
            ) : (
              <div className="actions">
                <button className="primary" onClick={install}>{l.installUpdate}</button>
              </div>
            )}
          </div>
        )}
      </Group>
      {check === "error" && <div className="error" role="alert">{checkErr}</div>}
      {installErr && <div className="error" role="alert">{installErr}</div>}
      {/* Announces the result of "Check now" to screen readers. */}
      <span className="sr-only" role="status">{status ?? (available ? fmt(l.updateAvailable, { version: available.version }) : "")}</span>

      <Group>
        <div className="about">
          <p>{l.privacy}</p>
          <p>{l.sources}</p>
          <p>{l.translationsNote}</p>
          <p>{l.openSource}</p>
        </div>
      </Group>

      <Group>
        <div className="about">
          <p>
            {fmt(l.madeBy, { name: "Saif Abu eideh" })} · <Link url={AUTHOR_URL} />
          </p>
          <p>
            {l.reportIssue} <Link url={ISSUES_URL} />
          </p>
        </div>
      </Group>
    </>
  );
}
