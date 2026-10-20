import type { ReactNode } from "react";

export function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-label">
        <span>{label}</span>
        {help && <small>{help}</small>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}
