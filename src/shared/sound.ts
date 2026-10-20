// A soft mechanical detent click, synthesised so no audio files are shipped.
let ctx: AudioContext | null = null;
let sleep = 0;

/** A running AudioContext keeps an audio stream open (and costs CPU) even when silent,
 *  so it's suspended a few seconds after the last click and resumed on the next one. */
const IDLE_MS = 3000;

export function click(strong = false) {
  ctx ??= new AudioContext();
  window.clearTimeout(sleep);
  sleep = window.setTimeout(() => void ctx?.suspend(), IDLE_MS);
  if (ctx.state === "suspended") {
    ctx.resume().then(() => play(ctx!, strong), () => {});
  } else {
    play(ctx, strong);
  }
}

function play(ctx: AudioContext, strong: boolean) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(strong ? 1250 : 1900, t);
  osc.frequency.exponentialRampToValueAtTime(strong ? 600 : 900, t + 0.03);
  filter.type = "bandpass";
  filter.frequency.value = strong ? 900 : 1600;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(strong ? 0.12 : 0.06, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (strong ? 0.12 : 0.045));
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.13);
}
