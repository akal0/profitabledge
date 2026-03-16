const CLICK_SRCS = [
  "/landing/key-click-1.wav",
  "/landing/key-click-2.wav",
  "/landing/key-click-3.wav",
  "/landing/key-click-4.wav",
];

let clickPool: HTMLAudioElement[] = [];

function initClickPool() {
  if (typeof window === "undefined" || clickPool.length > 0) return;
  clickPool = CLICK_SRCS.flatMap((src) => {
    const a = new Audio(src);
    const b = new Audio(src);
    a.preload = "auto";
    b.preload = "auto";
    return [a, b];
  });
}

if (typeof window !== "undefined") {
  initClickPool();
}

let _poolIdx = 0;

export function playKeyClick() {
  if (clickPool.length === 0) return;
  const el = clickPool[_poolIdx % clickPool.length];
  _poolIdx++;
  el.currentTime = 0;
  el.volume = 0.15 + Math.random() * 0.1;
  el.play().catch(() => {});
}
