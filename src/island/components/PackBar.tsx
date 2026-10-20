import type { Dispatch, SetStateAction } from "react";
import type { Pack, PackId } from "../../shared/content";
import type { Locale } from "../../i18n/en";

/** Above an adhkar: which set (a chip that opens a list of sets) and which dhikr within it. */
export function PackBar({ L, t, pack, packs, packOverride, setMenu, setSetMenu, choosePack, advance, at, textDir }: {
  L: Locale;
  t: Locale["island"];
  pack: Pack;
  packs: PackId[];
  packOverride: PackId | null;
  setMenu: boolean;
  setSetMenu: Dispatch<SetStateAction<boolean>>;
  choosePack: (p: PackId | null) => void;
  advance: (step: number) => void;
  at: number;
  textDir: "rtl" | "ltr";
}) {
  return (
    <div className="packbar">
      {/* Which set: a chip that opens a list of sets. */}
      <div className="setpick">
        <button className={`setchip${setMenu ? " open" : ""}`} aria-haspopup="menu" aria-expanded={setMenu} onClick={() => setSetMenu((v) => !v)}>
          {L.packs[pack.id]}
          <svg viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" /></svg>
        </button>
        {setMenu && (
          <div className="setmenu" role="menu" dir={textDir}>
            <button role="menuitemradio" aria-checked={!packOverride} className={!packOverride ? "on" : ""} onClick={() => choosePack(null)}>
              {L.settings.packAuto}
            </button>
            {packs.map((p) => (
              <button key={p} role="menuitemradio" aria-checked={packOverride === p} className={packOverride === p ? "on" : ""} onClick={() => choosePack(p)}>
                {L.packs[p]}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Which dhikr within the set. */}
      <div className="itemnav">
        <button className="nav" title={t.prev} aria-label={t.prev} onClick={() => advance(-1)}>‹</button>
        <span>{at + 1}/{pack.items.length}</span>
        <button className="nav" title={t.next} aria-label={t.next} onClick={() => advance(1)}>›</button>
      </div>
    </div>
  );
}
