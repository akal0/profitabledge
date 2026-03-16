const CLICK_SRCS = [
  "/landing/key-click-1.wav",
  "/landing/key-click-2.wav",
  "/landing/key-click-3.wav",
  "/landing/key-click-4.wav",
];

let ctx: AudioContext | null = null;
let buffers: AudioBuffer[] = [];
let ready = false;
let _idx = 0;

async function initAudio() {
  if (typeof window === "undefined" || ready) return;
  try {
    ctx = new AudioContext();
    const decoded = await Promise.all(
      CLICK_SRCS.map(async (src) => {
        const res = await fetch(src);
        const arr = await res.arrayBuffer();
        return ctx!.decodeAudioData(arr);
      })
    );
    buffers = decoded;
    ready = true;
  } catch {
    // Audio not available — fail silently
  }
}

// Unlock AudioContext on first user gesture (required by mobile browsers)
function unlockAudio() {
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const events = ["touchstart", "pointerdown", "keydown"];
  events.forEach((e) => window.removeEventListener(e, unlockAudio));
}

if (typeof window !== "undefined") {
  initAudio();
  const events = ["touchstart", "pointerdown", "keydown"];
  events.forEach((e) => window.addEventListener(e, unlockAudio));
}

export function playKeyClick() {
  if (!ctx || buffers.length === 0) return;
  // Resume if still suspended (no-op if already running)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
    return;
  }
  const buffer = buffers[_idx % buffers.length];
  _idx++;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.15 + Math.random() * 0.1;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}
