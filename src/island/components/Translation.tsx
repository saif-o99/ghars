import { useRef, useState } from "react";

/**
 * A translation clamped to two lines. Hovering it when it is cut off opens a card over
 * it with the whole text.
 */
export function Translation({ text, dir }: { text: string; dir: "rtl" | "ltr" }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const enter = () => {
    const el = ref.current;
    if (!el || el.scrollHeight <= el.clientHeight + 1) return;
    timer.current = window.setTimeout(() => setOpen(true), 300);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    <div className="tr-wrap" onMouseEnter={enter} onMouseLeave={leave}>
      <div className="tr" ref={ref} dir={dir}>{text}</div>
      {open && (
        <div className="tr-full" dir={dir} role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}
