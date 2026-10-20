import { useEffect, useState } from "react";

const media = (q: string) => window.matchMedia(q);

/** Whether a media query (a system preference such as dark mode) matches, following changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => media(query).matches);
  useEffect(() => {
    const list = media(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
