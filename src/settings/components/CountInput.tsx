import { useEffect, useState } from "react";

/**
 * A count from 1 to 10000. You can type freely; leaving the field (or Enter) rounds and
 * clamps it, and an empty or invalid entry goes back to the previous value.
 */
export function CountInput({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label?: string }) {
  const [text, setText] = useState(String(value));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- follow outside changes to the saved value
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    const next = text.trim() === "" || !Number.isFinite(n) ? value : Math.min(10_000, Math.max(1, Math.round(n)));
    setText(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <input
      type="number"
      min={1}
      max={10000}
      step={1}
      inputMode="numeric"
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}
