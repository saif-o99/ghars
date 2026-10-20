import type { Locale } from "../i18n/en";
import type { Settings } from "../shared/settings";

export type Section = "welcome" | "appearance" | "counting" | "ai" | "prayer" | "behavior" | "stats" | "about";
export type S = Locale["settings"];

export interface SectionProps {
  s: Settings;
  L: Locale;
  l: S;
  update: (p: Partial<Settings>) => Promise<void>;
}
