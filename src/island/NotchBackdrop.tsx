/**
 * Background and shadow of the notch-style island, drawn as a separate shape behind it.
 * The shadow used to be a filter on the island's wrapper, so the browser re-blurred the
 * whole island on every frame the wheel turned; this shape never changes while the
 * contents animate, so its blur is computed once.
 */
export function NotchBackdrop({ themeId, width, height, mask, flash = false }: {
  themeId: string;
  width: number;
  height: number;
  mask?: string;
  flash?: boolean;
}) {
  return (
    <div className="notch-backdrop" aria-hidden>
      <div
        className={`notch-bg theme-${themeId}${flash ? " flash" : ""}`}
        style={{ width, height, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}) }}
      />
    </div>
  );
}
