import type { CSSProperties } from "react";
import { ISTIGHFAR } from "../../shared/content";
import type { Lang } from "../../i18n";
import { THEMES, tileUrl, type Theme } from "../../shared/themes";
import { Deco } from "../../island/Deco";

function ThemeCard({ theme }: { theme: Theme }) {
  const style = { "--tile": theme.tile ? tileUrl(theme.tile) : "none", "--radius": "12px", "--ar-size": "15px" } as CSSProperties;
  return (
    <div className={`preview theme-${theme.id} is-expanded`} style={style}>
      <Deco theme={theme} />
      <div className="pv-text">
        <span className="ar" lang="ar">{ISTIGHFAR.short.ar}</span>
        <span className="pv-dot" />
      </div>
    </div>
  );
}

/** Theme swatches. Hovering or focusing one shows it in the live preview; clicking picks it. */
export function ThemeGrid({ value, lang, onPick, onHover }: { value: string; lang: Lang; onPick: (id: string) => void; onHover?: (id: string | null) => void }) {
  return (
    <div className="themes" onMouseLeave={() => onHover?.(null)} onBlur={() => onHover?.(null)}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-card ${value === t.id ? "selected" : ""}`}
          aria-pressed={value === t.id}
          aria-label={lang === "ar" ? t.ar : t.en}
          onClick={() => onPick(t.id)}
          onMouseEnter={() => onHover?.(t.id)}
          onFocus={() => onHover?.(t.id)}
        >
          <ThemeCard theme={t} />
        </button>
      ))}
    </div>
  );
}
