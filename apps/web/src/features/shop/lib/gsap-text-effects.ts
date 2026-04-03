export const GSAP_TEXT_EFFECT_KEYS = [
  "name_scramble",
  "name_wave_v2",
  "name_typewriter_v2",
] as const;

export function isGsapTextEffect(effect?: string | null) {
  return Boolean(
    effect && GSAP_TEXT_EFFECT_KEYS.includes(effect as (typeof GSAP_TEXT_EFFECT_KEYS)[number])
  );
}

export const SCRAMBLE_CHARSET = "01!@#$%&*";
