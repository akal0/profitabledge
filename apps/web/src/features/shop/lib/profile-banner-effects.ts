export type BannerParticleDefinition = {
  left: number;
  top: number;
  size: number;
  delay: string;
  duration: string;
  driftX: number;
  opacity: number;
  rotate: number;
};

export const BANNER_PARTICLES: BannerParticleDefinition[] = [
  { left: 8, top: -8, size: 3, delay: "0s", duration: "9s", driftX: 10, opacity: 0.7, rotate: 8 },
  { left: 18, top: -12, size: 4, delay: "0.6s", duration: "10s", driftX: -8, opacity: 0.6, rotate: -10 },
  { left: 28, top: -6, size: 2, delay: "1.2s", duration: "8.5s", driftX: 12, opacity: 0.8, rotate: 20 },
  { left: 40, top: -10, size: 5, delay: "0.9s", duration: "10.8s", driftX: -12, opacity: 0.55, rotate: -18 },
  { left: 52, top: -7, size: 3, delay: "1.8s", duration: "9.6s", driftX: 9, opacity: 0.72, rotate: 12 },
  { left: 64, top: -11, size: 4, delay: "0.4s", duration: "11s", driftX: -10, opacity: 0.58, rotate: -14 },
  { left: 76, top: -8, size: 3, delay: "2.1s", duration: "8.8s", driftX: 14, opacity: 0.74, rotate: 16 },
  { left: 88, top: -10, size: 5, delay: "1.4s", duration: "10.4s", driftX: -14, opacity: 0.56, rotate: -20 },
  { left: 14, top: -18, size: 2, delay: "2.6s", duration: "12.2s", driftX: 6, opacity: 0.64, rotate: 10 },
  { left: 34, top: -16, size: 4, delay: "1.1s", duration: "9.4s", driftX: -6, opacity: 0.66, rotate: -12 },
  { left: 58, top: -20, size: 3, delay: "2.4s", duration: "11.4s", driftX: 8, opacity: 0.62, rotate: 18 },
  { left: 82, top: -14, size: 2, delay: "0.2s", duration: "8.9s", driftX: -9, opacity: 0.78, rotate: -6 },
];

export const BANNER_SPARKLES = [
  { left: 12, top: 18, delay: "0s", duration: "2.2s", size: 5 },
  { left: 28, top: 26, delay: "0.4s", duration: "2.6s", size: 4 },
  { left: 48, top: 20, delay: "1.1s", duration: "2.8s", size: 6 },
  { left: 68, top: 32, delay: "0.8s", duration: "2.4s", size: 4 },
  { left: 86, top: 18, delay: "1.5s", duration: "2.9s", size: 5 },
  { left: 74, top: 58, delay: "0.1s", duration: "2.5s", size: 4 },
] as const;

export const MATRIX_COLUMNS = [
  { left: 5, delay: "0s", duration: "5.1s", glyph: "0101" },
  { left: 13, delay: "0.35s", duration: "4.8s", glyph: "$TSLA" },
  { left: 21, delay: "0.7s", duration: "5.3s", glyph: "RR>2" },
  { left: 29, delay: "0.15s", duration: "4.9s", glyph: "1010" },
  { left: 37, delay: "0.55s", duration: "5.4s", glyph: "PE++" },
  { left: 45, delay: "0.95s", duration: "4.7s", glyph: "BULL" },
  { left: 53, delay: "0.25s", duration: "5.2s", glyph: "0110" },
  { left: 61, delay: "0.8s", duration: "4.6s", glyph: "NQ++" },
  { left: 69, delay: "0.45s", duration: "5.1s", glyph: "AAPL" },
  { left: 77, delay: "1.05s", duration: "4.8s", glyph: "WINR" },
  { left: 85, delay: "0.6s", duration: "5.4s", glyph: "0111" },
  { left: 93, delay: "0.2s", duration: "4.9s", glyph: "EDGE" },
] as const;

export const CONFETTI_PARTICLES = [
  { left: 10, top: -8, size: 8, delay: "0s", duration: "7s", driftX: 8, opacity: 0.8, rotate: 25 },
  { left: 22, top: -12, size: 6, delay: "0.4s", duration: "6.5s", driftX: -12, opacity: 0.76, rotate: -28 },
  { left: 38, top: -10, size: 7, delay: "1s", duration: "7.4s", driftX: 12, opacity: 0.74, rotate: 32 },
  { left: 54, top: -16, size: 9, delay: "0.7s", duration: "6.8s", driftX: -10, opacity: 0.72, rotate: -18 },
  { left: 70, top: -8, size: 7, delay: "1.2s", duration: "7.1s", driftX: 14, opacity: 0.78, rotate: 22 },
  { left: 86, top: -12, size: 6, delay: "1.8s", duration: "6.9s", driftX: -8, opacity: 0.7, rotate: -24 },
] as const;
