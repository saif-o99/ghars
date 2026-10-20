import type { KeyboardEvent } from "react";

/** Radio buttons in a row: one tab stop for the group, arrow keys move the choice (like native radios). */
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  const current = options.some(([v]) => v === value) ? value : options[0]?.[0];
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const n = options.length;
    const i = options.findIndex(([v]) => v === current);
    const forward = e.key === "ArrowDown" || e.key === (getComputedStyle(e.currentTarget).direction === "rtl" ? "ArrowLeft" : "ArrowRight");
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (forward ? 1 : -1) + n) % n;
    (e.currentTarget.children[j] as HTMLElement | undefined)?.focus();
    if (options[j][0] !== value) onChange(options[j][0]);
  }
  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map(([v, text]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} tabIndex={v === current ? 0 : -1} className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
