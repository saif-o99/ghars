import type { PrayerName } from "../shared/prayer";

export type View = "collapsed" | "compact" | "expanded";
export type Mode = "istighfar" | "adhkar";

/** A prayer note shown in the compact island. */
export type PrayerNotice = { name: PrayerName; time: Date };

/** Pending timeouts, shared by hovering, dragging and counting. */
export type IslandTimers = { enter?: number; leave?: number; hint?: number; tray?: number };
