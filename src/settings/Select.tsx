import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, JSX, KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import "./select.css";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  /** Shows a filter box at the top of the popover (for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown (and announced to screen readers) when the filter matches nothing. */
  noResults?: string;
  /** Trigger width; default 260px. */
  width?: number | string;
  /** Optional direction override; otherwise inherited from the trigger's computed direction. */
  dir?: "rtl" | "ltr";
  /** Extra class on the trigger (e.g. to tint its background in the sidebar). */
  className?: string;
}

/** Gap between trigger and popover. */
const GAP = 6;
/** Minimum distance from the viewport edges. */
const EDGE = 8;
/** Max height of the scrolling option list. */
const LIST_MAX = 300;
/** Typeahead buffer reset delay (ms). */
const TYPE_RESET = 600;

/** Case/accent-insensitive folding: strips Latin combining marks and Arabic harakat, "_" → " ". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function isPrintable(e: ReactKeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

interface Pos {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  listMax: number;
  up: boolean;
}

interface Item<T extends string> {
  o: SelectOption<T>;
  /** Index in the original `options` array (stable id). */
  i: number;
  label: string;
  value: string;
}

type ScrollReq = "none" | "center" | "nearest";

export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  searchable = false,
  searchPlaceholder,
  noResults,
  width = 260,
  dir,
  className,
}: SelectProps<T>): JSX.Element {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef({ buf: "", at: 0 });
  const pointerRef = useRef({ x: -1, y: -1 });
  const scrollReq = useRef<ScrollReq>("none");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Index into `visible`. */
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const [popDir, setPopDir] = useState<"rtl" | "ltr">("ltr");
  const [popLang, setPopLang] = useState<string | undefined>(undefined);
  const [reduce, setReduce] = useState(false);
  const [triggerW, setTriggerW] = useState(0);

  const items = useMemo<Item<T>[]>(
    () => options.map((o, i) => ({ o, i, label: fold(o.label), value: fold(o.value) })),
    [options],
  );
  const visible = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return items;
    return items.filter((it) => it.label.includes(q) || it.value.includes(q));
  }, [items, query]);

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : undefined;

  // ---------- open / close ----------
  const openMenu = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    // The popover is portaled to <body>, so carry over direction, language and reduce-motion.
    setPopDir(dir ?? (getComputedStyle(t).direction === "rtl" ? "rtl" : "ltr"));
    setPopLang(t.closest("[lang]")?.getAttribute("lang") ?? undefined);
    setReduce(t.closest(".reduce-motion") !== null);
    setTriggerW(t.getBoundingClientRect().width);
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setPos(null);
    typeRef.current.buf = "";
    scrollReq.current = "center";
    setOpen(true);
  }, [dir, options, value]);

  const closeMenu = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const commit = (k: number) => {
    const it = visible[k];
    if (!it) return;
    closeMenu(true);
    if (it.o.value !== value) onChange(it.o.value);
  };

  // ---------- positioning ----------
  const place = useCallback(() => {
    const t = triggerRef.current;
    const pop = popRef.current;
    const list = listRef.current;
    if (!t || !pop || !list) return;
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const chrome = pop.offsetHeight - list.offsetHeight; // padding + borders + search box
    const desired = Math.min(LIST_MAX, list.scrollHeight) + chrome;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = desired > below && above > below;
    const listMax = Math.max(68, Math.min(LIST_MAX, (up ? above : below) - chrome));
    setPos((prev) => {
      // Lock the width on first measure so filtering doesn't make the popover jump.
      const width = Math.min(prev?.width ?? Math.max(r.width, pop.offsetWidth), vw - EDGE * 2);
      let left = popDir === "rtl" ? r.right - width : r.left;
      left = Math.max(EDGE, Math.min(left, vw - EDGE - width));
      return {
        left,
        width,
        listMax,
        up,
        top: up ? undefined : r.bottom + GAP,
        bottom: up ? vh - r.top + GAP : undefined,
      };
    });
  }, [popDir]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      place();
    };
    const onResize = () => place();
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (triggerRef.current?.contains(n) || popRef.current?.contains(n)) return;
      closeMenu(false);
    };
    const onBlur = () => closeMenu(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onBlur);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, place, closeMenu]);

  const shown = open && pos !== null;

  // Focus the search box once the popover is visible (can't focus while visibility:hidden).
  useEffect(() => {
    if (shown && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [shown, searchable]);

  // Keep the active option in view (keyboard-driven moves only, not hover).
  useLayoutEffect(() => {
    if (!shown || scrollReq.current === "none") return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    if (!list || !el) return;
    const mode = scrollReq.current;
    scrollReq.current = "none";
    if (mode === "center") {
      list.scrollTop = el.offsetTop - (list.clientHeight - el.offsetHeight) / 2;
    } else if (el.offsetTop < list.scrollTop + 4) {
      list.scrollTop = el.offsetTop - 4;
    } else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight - 4) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
    }
  }, [shown, active, visible]);

  // ---------- keyboard ----------
  const moveTo = (k: number) => {
    if (!visible.length) return;
    scrollReq.current = "nearest";
    setActive(k);
  };

  const typeahead = (ch: string, from: number) => {
    const now = Date.now();
    const t = typeRef.current;
    t.buf = now - t.at > TYPE_RESET ? ch : t.buf + ch;
    t.at = now;
    const q = fold(t.buf);
    const n = items.length;
    if (!n || !q.trim()) return;
    // Repeating one letter cycles through options starting with it.
    const cycling = [...q].every((c) => c === q[0]);
    const needle = cycling ? q[0] : q;
    const start = cycling ? from + 1 : from;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (items[i].label.startsWith(needle)) {
        scrollReq.current = "nearest";
        setActive(i);
        return;
      }
    }
  };

  /** Shared list navigation for the trigger and the search box. Returns true if handled. */
  const onListKey = (e: ReactKeyboardEvent<HTMLElement>): boolean => {
    const n = visible.length;
    switch (e.key) {
      case "ArrowDown":
        moveTo(n ? (active + 1) % n : 0);
        break;
      case "ArrowUp":
        moveTo(n ? (active - 1 + n) % n : 0);
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(n - 1);
        break;
      case "PageDown":
        moveTo(Math.min(n - 1, active + 8));
        break;
      case "PageUp":
        moveTo(Math.max(0, active - 8));
        break;
      case "Enter":
        commit(active);
        break;
      case "Escape":
        closeMenu(true);
        break;
      case "Tab":
        // Return focus to the trigger and let the browser continue the Tab from there.
        closeMenu(true);
        return false;
      default:
        return false;
    }
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      } else if (!searchable && isPrintable(e)) {
        e.preventDefault();
        openMenu();
        typeahead(e.key, Math.max(0, selectedIdx));
      }
      return;
    }
    if (searchable) {
      // Focus normally lives in the search box; handle the trigger gracefully anyway.
      onListKey(e);
      return;
    }
    if (onListKey(e)) return;
    if (e.key === " ") {
      e.preventDefault();
      // Space continues a typeahead in progress ("New York"), otherwise selects.
      if (Date.now() - typeRef.current.at < TYPE_RESET && typeRef.current.buf) typeahead(" ", active);
      else commit(active);
    } else if (isPrintable(e)) {
      e.preventDefault();
      typeahead(e.key, active);
    }
  };

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    onListKey(e);
  };

  const onSearchChange = (q: string) => {
    setQuery(q);
    scrollReq.current = "nearest";
    if (q.trim()) {
      setActive(0);
    } else {
      setActive(Math.max(0, selectedIdx));
      scrollReq.current = "center";
    }
  };

  // ---------- render ----------
  const activeItem = open ? visible[active] : undefined;
  const activeId = activeItem ? optId(activeItem.i) : undefined;

  const triggerStyle: CSSProperties = { width: typeof width === "number" ? `${width}px` : width };

  const popStyle: CSSProperties = pos
    ? { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }
    : { left: 0, top: 0, visibility: "hidden", minWidth: triggerW, maxWidth: Math.max(triggerW, 420) };

  const popover = (
    <div
      ref={popRef}
      className={`gs-pop${pos?.up ? " is-up" : ""}${reduce ? " gs-reduce" : ""}`}
      dir={popDir}
      lang={popLang}
      style={popStyle}
      // Keep focus on the trigger / search box while clicking inside the popover.
      onMouseDown={(e) => {
        if (e.target !== searchRef.current) e.preventDefault();
      }}
    >
      {searchable && (
        <div className="gs-search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder ?? ariaLabel}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKey}
          />
        </div>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        className="gs-list"
        style={pos ? { maxHeight: pos.listMax } : undefined}
      >
        {visible.length === 0 ? (
          <div className="gs-empty" aria-hidden="true">
            {noResults ?? "—"}
          </div>
        ) : (
          visible.map((it, k) => {
            const isSel = it.o.value === value;
            return (
              <div
                key={it.o.value}
                id={optId(it.i)}
                data-idx={k}
                role="option"
                aria-selected={isSel}
                className={`gs-opt${k === active ? " is-active" : ""}${isSel ? " is-selected" : ""}`}
                onMouseMove={(e) => {
                  // Ignore synthetic moves caused by keyboard scrolling under a still pointer.
                  const p = pointerRef.current;
                  if (p.x === e.clientX && p.y === e.clientY) return;
                  p.x = e.clientX;
                  p.y = e.clientY;
                  if (k !== active) setActive(k);
                }}
                onClick={() => commit(k)}
              >
                <span className="gs-opt-label">{it.o.label}</span>
                {it.o.hint && <span className="gs-opt-hint">{it.o.hint}</span>}
                <svg className="gs-check" viewBox="0 0 16 16" aria-hidden="true">
                  {isSel && <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />}
                </svg>
              </div>
            );
          })
        )}
      </div>
      {/* The empty row sits inside the listbox, so the message is announced from here. */}
      <span className="sr-only" role="status">
        {visible.length === 0 ? noResults ?? "—" : ""}
      </span>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={0}
        dir={dir}
        className={`gs-trigger${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
        style={triggerStyle}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={!searchable ? activeId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <span className="gs-trigger-label">{selected ? selected.label : value}</span>
        <svg className="gs-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
      {open && createPortal(popover, document.body)}
    </>
  );
}
