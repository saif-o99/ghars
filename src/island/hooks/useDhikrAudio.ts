import { useEffect, useRef, useState } from "react";
import type { Dhikr } from "../../shared/content";
import { AUDIO } from "../../shared/audio";
import type { View } from "../types";

/** "Listen": play the recorded reading of the current dhikr. */
export function useDhikrAudio(item: Dhikr, view: View) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    audio.current?.pause();
    audio.current = null;
    setPlaying(false);
  }
  function toggleListen() {
    if (playing) return stopAudio();
    const src = AUDIO[item.id];
    if (!src) return;
    const a = new Audio(src);
    audio.current = a;
    a.onended = a.onerror = () => {
      if (audio.current === a) stopAudio();
    };
    a.play().then(() => setPlaying(true)).catch(stopAudio);
  }
  useEffect(() => {
    if (view !== "expanded" || audio.current) stopAudio();
  }, [item.id, view]);

  return { playing, toggleListen };
}
