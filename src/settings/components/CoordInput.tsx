import { useEffect, useState } from "react";

/**
 * Latitude or longitude. Only numbers within ±`limit` are saved; anything else stays in
 * the field, marked invalid, until it is fixed.
 */
export function CoordInput({ value, limit, label, placeholder, onCommit, onValid }: {
  value: number | null;
  limit: number;
  label: string;
  placeholder: string;
  onCommit: (v: number | null) => void;
  onValid: (ok: boolean) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  // Follow outside changes ("Use my location", another city) without fighting the typing.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the saved value, see above
  useEffect(() => setText((t) => (t.trim() !== "" && Number(t) === value ? t : value == null ? "" : String(value))), [value]);
  const n = Number(text);
  const ok = text.trim() === "" || (Number.isFinite(n) && Math.abs(n) <= limit);
  return (
    <input
      type="number"
      step="0.0001"
      min={-limit}
      max={limit}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={!ok}
      onChange={(e) => {
        const t = e.target.value;
        const v = Number(t);
        const valid = t.trim() === "" || (Number.isFinite(v) && Math.abs(v) <= limit);
        setText(t);
        onValid(valid);
        if (valid) onCommit(t.trim() === "" ? null : v);
      }}
    />
  );
}
