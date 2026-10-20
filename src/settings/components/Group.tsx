import type { ReactNode } from "react";

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      {title && <div className="gtitle">{title}</div>}
      <div className="group">{children}</div>
    </>
  );
}
