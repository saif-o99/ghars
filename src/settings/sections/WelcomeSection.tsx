import { useState } from "react";
import { ThemeGrid } from "../components/ThemeGrid";
import { WithPreview } from "../components/WithPreview";
import type { Section, SectionProps } from "../types";

export function WelcomeSection({ s, L, l, update, go }: SectionProps & { go: (s: Section) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <WithPreview s={s} L={L} themeId={hover ?? s.theme}>
      <div className="welcome">
        <p className="lead">{l.welcomeBody}</p>
        <ol>
          <li><button className="link" onClick={() => go("appearance")}>{l.step1}</button></li>
          <li><button className="link" onClick={() => go("ai")}>{l.step2}</button></li>
          <li><button className="link" onClick={() => go("prayer")}>{l.step3}</button></li>
        </ol>
        <div className="gtitle">{l.themes}</div>
        <ThemeGrid value={s.theme} lang={s.uiLang} onPick={(id) => update({ theme: id })} onHover={setHover} />
        <button className="primary" onClick={() => update({ onboarded: true }).then(() => go("appearance"))}>
          {l.finish}
        </button>
      </div>
    </WithPreview>
  );
}
