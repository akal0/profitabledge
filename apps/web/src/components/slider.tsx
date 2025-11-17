"use client";

import { useId, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useSliderWithInput } from "@/hooks/use-slider-with-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type RangeSliderProps = {
  label?: string;
  min: number;
  max: number;
  value?: [number, number];
  defaultValue?: [number, number];
  onChange?: (range: [number, number]) => void;
  onCommit?: (range: [number, number]) => void;
  prefix?: string;
  suffix?: string;
  histogramData?: number[];
  bins?: number;
  // Cosmetic spikes across the slider, normalized positions [0..1]
  spikePositions?: number[];
  baseBarPct?: number; // baseline bar height percentage (cosmetic)
  spikeBarPct?: number; // spike height percentage (cosmetic)
  mode?: "duration" | "number";
  minInputLabel?: string;
  maxInputLabel?: string;
  showCountButton?: boolean;
  countLabel?: (count: number) => string;
  disabled?: boolean;
  onCountButtonClick?: (range: [number, number]) => void;
};

export default function RangeSlider({
  label,
  min,
  max,
  value,
  defaultValue,
  onChange,
  onCommit,
  prefix,
  suffix,
  histogramData,
  bins = 40,
  spikePositions,
  baseBarPct = 6,
  spikeBarPct = 70,
  mode = "duration",
  minInputLabel,
  maxInputLabel,
  showCountButton = false,
  countLabel,
  disabled,
  onCountButtonClick,
}: RangeSliderProps) {
  const id = useId();
  const formatSeconds = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
  };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [effectiveBins, setEffectiveBins] = useState<number>(bins);
  const [wavePhase, setWavePhase] = useState<number>(0);
  const [waveActive, setWaveActive] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const parseDuration = (text: string): number | null => {
    if (!text) return 0;
    const raw = text.trim().toLowerCase();
    // hh:mm:ss or mm:ss
    if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(raw)) {
      const parts = raw.split(":").map((p) => parseInt(p || "0", 10));
      if (parts.length === 3) {
        const [h, m, s] = parts;
        return h * 3600 + m * 60 + s;
      }
      if (parts.length === 2) {
        const [m, s] = parts;
        return m * 60 + s;
      }
    }
    // 1h 2m 3s (any order)
    let total = 0;
    let matched = false;
    const h = raw.match(/(\d+)\s*h/);
    const m = raw.match(/(\d+)\s*m/);
    const s = raw.match(/(\d+)\s*s/);
    if (h) {
      matched = true;
      total += parseInt(h[1]!, 10) * 3600;
    }
    if (m) {
      matched = true;
      total += parseInt(m[1]!, 10) * 60;
    }
    if (s) {
      matched = true;
      total += parseInt(s[1]!, 10);
    }
    if (matched) return total;
    // plain number -> seconds
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    return null;
  };
  const parseNumber = (text: string): number | null => {
    if (text == null) return 0;
    const cleaned = String(text).replace(/[^0-9+\-\.]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  };
  const formatNumber = (n: number): string => {
    const num = Number(n || 0);
    const negative = num < 0;
    const absStr = Math.abs(num).toLocaleString();
    const pre = prefix || "";
    const suf = suffix || "";
    // Ensure minus sign precedes the currency prefix: -$123
    return `${negative ? "-" : ""}${pre}${absStr}${suf}`;
  };
  const initial: [number, number] = value
    ? [value[0], value[1]]
    : defaultValue
    ? [defaultValue[0], defaultValue[1]]
    : [min, max];
  const [formattedMin, setFormattedMin] = useState<string>(
    mode === "duration"
      ? formatSeconds(Number(initial[0] || 0))
      : formatNumber(Number(initial[0] || 0))
  );
  const [formattedMax, setFormattedMax] = useState<string>(
    mode === "duration"
      ? formatSeconds(Number(initial[1] || 0))
      : formatNumber(Number(initial[1] || 0))
  );

  // initial is declared above

  const {
    sliderValue,
    inputValues,
    validateAndUpdateValue,
    handleInputChange,
    handleSliderChange,
  } = useSliderWithInput({
    minValue: min,
    maxValue: max,
    initialValue: initial,
    defaultValue: [min, max],
  });

  // keep controlled value in sync
  useEffect(() => {
    if (!value) return;
    handleSliderChange([value[0], value[1]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.[0], value?.[1]]);

  // Adjust bin count to fill container width (~4px per column), bounded for performance
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.offsetWidth || 0;
      if (!w) return;
      const suggested = Math.round(w / 4);
      const next = Math.max(bins, Math.min(300, Math.max(40, suggested)));
      setEffectiveBins(next);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => {
      try {
        ro.disconnect();
      } catch {}
    };
  }, [bins]);

  const priceStep = (max - min) / Math.max(1, effectiveBins);

  // Cosmetic heights if spikePositions provided; otherwise compute from histogramData
  let barHeightsPct: number[] | null = null;
  if (spikePositions && spikePositions.length > 0) {
    // Randomized heights across the entire width, with slight adjacency correlation
    const heights: number[] = new Array(effectiveBins).fill(0).map((_, i) => {
      // deterministic pseudo-random on index
      const r = (Math.sin((i + 1) * 15) * 40000) % 1;
      const rnd = r < 0 ? r + 1 : r; // ensure [0,1)
      const h = baseBarPct + rnd * (spikeBarPct - baseBarPct);
      return Math.max(0, Math.min(100, h));
    });
    // light smoothing to create neighboring variation (clusters)
    for (let i = 1; i < heights.length - 1; i++) {
      heights[i] =
        heights[i - 1]! * 0.2 + heights[i]! * 0.6 + heights[i + 1]! * 0.2;
    }
    // Boost specified spike positions and neighbors
    for (const p of spikePositions) {
      const idx = Math.max(
        0,
        Math.min(effectiveBins - 1, Math.round((p || 0) * (effectiveBins - 1)))
      );
      const r2 = (Math.sin((idx + 3.33) * 78.233) * 96485.332) % 1;
      const rnd2 = r2 < 0 ? r2 + 1 : r2;
      const target = baseBarPct + rnd2 * (spikeBarPct - baseBarPct);
      heights[idx] = Math.max(heights[idx]!, target);
      if (idx - 1 >= 0)
        heights[idx - 1] = Math.max(heights[idx - 1]!, target * 0.7);
      if (idx + 1 < heights.length)
        heights[idx + 1] = Math.max(heights[idx + 1]!, target * 0.7);
    }
    barHeightsPct = heights;
  }

  const itemCounts = barHeightsPct
    ? null
    : Array(effectiveBins)
        .fill(0)
        .map((_, tick) => {
          if (!histogramData || histogramData.length === 0) return 0;
          const rangeMin = min + tick * priceStep;
          const rangeMax = min + (tick + 1) * priceStep;
          const inclusiveUpper = tick === effectiveBins - 1;
          let c = 0;
          for (let i = 0; i < histogramData.length; i++) {
            const v = histogramData[i]!;
            if (
              v >= rangeMin &&
              (inclusiveUpper ? v <= rangeMax : v < rangeMax)
            )
              c++;
          }
          return c;
        });

  const maxCount = itemCounts ? Math.max(1, ...itemCounts) : 1;

  // Animate wave when user is interacting with the slider
  useEffect(() => {
    if (!waveActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setWavePhase((p) => p + dt * 0.006); // speed factor
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [waveActive]);

  const handleSliderValueChange = (values: number[]) => {
    handleSliderChange(values);
    onChange?.([values[0]!, values[1]!]);
    // keep formatted inputs in sync when sliding
    setFormattedMin(
      mode === "duration"
        ? formatSeconds(Number(values[0] || 0))
        : formatNumber(Number(values[0] || 0))
    );
    setFormattedMax(
      mode === "duration"
        ? formatSeconds(Number(values[1] || 0))
        : formatNumber(Number(values[1] || 0))
    );
  };

  const countInRange = (lo: number, hi: number) => {
    if (!histogramData || histogramData.length === 0) return 0;
    let c = 0;
    for (let i = 0; i < histogramData.length; i++) {
      const v = histogramData[i]!;
      if (v >= lo && v <= hi) c++;
    }
    return c;
  };

  const isBarInSelectedRange = (
    index: number,
    minValue: number,
    step: number,
    selected: number[]
  ) => {
    const rangeMin = minValue + index * step;
    const rangeMax = minValue + (index + 1) * step;
    return rangeMin <= selected[1]! && rangeMax >= selected[0]!;
  };

  const commitCurrent = () => onCommit?.([sliderValue[0]!, sliderValue[1]!]);

  // When sliderValue changes from any source, reflect in formatted inputs
  useEffect(() => {
    if (Array.isArray(sliderValue) && sliderValue.length >= 2) {
      setFormattedMin(
        mode === "duration"
          ? formatSeconds(Number(sliderValue[0] || 0))
          : formatNumber(Number(sliderValue[0] || 0))
      );
      setFormattedMax(
        mode === "duration"
          ? formatSeconds(Number(sliderValue[1] || 0))
          : formatNumber(Number(sliderValue[1] || 0))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue?.[0], sliderValue?.[1]]);

  return (
    <div className="*:not-first:mt-4 flex flex-col gap-2">
      {label ? <Label>{label}</Label> : null}
      <div
        onMouseDown={() => setWaveActive(true)}
        onMouseUp={() => setWaveActive(false)}
        onTouchStart={() => setWaveActive(true)}
        onTouchEnd={() => setWaveActive(false)}
      >
        {/* Histogram bars */}
        {(spikePositions && spikePositions.length > 0) ||
        (histogramData && histogramData.length > 0) ? (
          <div
            ref={containerRef}
            className="grid h-12 w-full items-end"
            style={{
              gridTemplateColumns: `repeat(${effectiveBins}, minmax(0, 1fr))`,
            }}
            aria-hidden="true"
          >
            {(barHeightsPct || itemCounts || []).map((val, i) => {
              const basePct = barHeightsPct
                ? barHeightsPct[i]!
                : (((itemCounts as number[])[i]! || 0) / maxCount) * 100;
              const amp = 8; // wave amplitude in percent
              const freq = 0.28; // wave frequency
              const wave = waveActive
                ? Math.sin(i * freq + wavePhase) * amp
                : 0;
              const pct = Math.max(8, Math.min(100, basePct + wave));
              return (
                <div
                  key={i}
                  className="self-end"
                  style={{
                    height: `${pct}%`,
                    transition: waveActive
                      ? "height 60ms linear"
                      : "height 180ms ease",
                  }}
                >
                  <span
                    data-selected={isBarInSelectedRange(
                      i,
                      min,
                      priceStep,
                      sliderValue
                    )}
                    className="block w-full h-full bg-white/25"
                  />
                </div>
              );
            })}
          </div>
        ) : null}
        <Slider
          value={sliderValue as number[]}
          onValueChange={handleSliderValueChange}
          min={min}
          max={max}
          aria-label={label || "Range"}
          disabled={disabled}
          showTooltip
          tooltipContent={(v) =>
            mode === "duration" ? formatSeconds(v) : formatNumber(v)
          }
          onPointerDown={() => setWaveActive(true)}
          onPointerUp={() => setWaveActive(false)}
        />
      </div>

      <div className="flex flex-col gap-2">
        {/* Inputs */}
        <div className="*:not-first:mt-1 flex flex-col gap-1">
          <Label
            htmlFor={`${id}-min`}
            className="text-xs text-center font-normal text-white/60"
          >
            {minInputLabel ||
              (mode === "duration" ? "Minimum hold time" : "Minimum")}
          </Label>
          <Input
            id={`${id}-min`}
            className="peer w-full"
            type="text"
            inputMode="text"
            value={formattedMin}
            onChange={(e) => {
              setWaveActive(true);
              setFormattedMin(e.target.value);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              setWaveActive(true);
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const parsed =
                  mode === "duration"
                    ? parseDuration(formattedMin)
                    : parseNumber(formattedMin);
                if (parsed == null) {
                  setFormattedMin(
                    mode === "duration"
                      ? formatSeconds(Number(inputValues[0] || 0))
                      : formatNumber(Number(inputValues[0] || 0))
                  );
                  return;
                }
                const clamped = Math.max(min, Math.min(max, parsed));
                handleInputChange(
                  { target: { value: String(clamped) } } as any,
                  0
                );
                validateAndUpdateValue(String(clamped), 0);
                setFormattedMin(
                  mode === "duration"
                    ? formatSeconds(clamped)
                    : formatNumber(clamped)
                );
                commitCurrent();
                setWaveActive(false);
              } else if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "ArrowUp" ||
                e.key === "ArrowDown"
              ) {
                e.stopPropagation();
              }
            }}
            onBlur={() => {
              const parsed =
                mode === "duration"
                  ? parseDuration(formattedMin)
                  : parseNumber(formattedMin);
              if (parsed == null) {
                setFormattedMin(
                  mode === "duration"
                    ? formatSeconds(Number(inputValues[0] || 0))
                    : formatNumber(Number(inputValues[0] || 0))
                );
                return;
              }
              const clamped = Math.max(min, Math.min(max, parsed));
              handleInputChange(
                { target: { value: String(clamped) } } as any,
                0
              );
              validateAndUpdateValue(String(clamped), 0);
              setFormattedMin(
                mode === "duration"
                  ? formatSeconds(clamped)
                  : formatNumber(clamped)
              );
              commitCurrent();
              setWaveActive(false);
            }}
            placeholder={
              mode === "duration"
                ? "e.g. 1h 2m 30s or 75:00"
                : `e.g. ${prefix || ""}100${suffix || ""}`
            }
            disabled={disabled}
          />
        </div>

        <div className="*:not-first:mt-1 flex flex-col gap-2">
          <Label
            htmlFor={`${id}-max`}
            className="text-xs text-white/60 font-normal"
          >
            {maxInputLabel ||
              (mode === "duration" ? "Max hold time" : "Maximum")}
          </Label>
          <Input
            id={`${id}-max`}
            className="peer w-full"
            type="text"
            inputMode="text"
            value={formattedMax}
            onChange={(e) => {
              setWaveActive(true);
              setFormattedMax(e.target.value);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              setWaveActive(true);
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const parsed =
                  mode === "duration"
                    ? parseDuration(formattedMax)
                    : parseNumber(formattedMax);
                if (parsed == null) {
                  setFormattedMax(
                    mode === "duration"
                      ? formatSeconds(Number(inputValues[1] || 0))
                      : formatNumber(Number(inputValues[1] || 0))
                  );
                  return;
                }
                const clamped = Math.max(min, Math.min(max, parsed));
                handleInputChange(
                  { target: { value: String(clamped) } } as any,
                  1
                );
                validateAndUpdateValue(String(clamped), 1);
                setFormattedMax(
                  mode === "duration"
                    ? formatSeconds(clamped)
                    : formatNumber(clamped)
                );
                commitCurrent();
                setWaveActive(false);
              } else if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "ArrowUp" ||
                e.key === "ArrowDown"
              ) {
                e.stopPropagation();
              }
            }}
            onBlur={() => {
              const parsed =
                mode === "duration"
                  ? parseDuration(formattedMax)
                  : parseNumber(formattedMax);
              if (parsed == null) {
                setFormattedMax(
                  mode === "duration"
                    ? formatSeconds(Number(inputValues[1] || 0))
                    : formatNumber(Number(inputValues[1] || 0))
                );
                return;
              }
              const clamped = Math.max(min, Math.min(max, parsed));
              handleInputChange(
                { target: { value: String(clamped) } } as any,
                1
              );
              validateAndUpdateValue(String(clamped), 1);
              setFormattedMax(
                mode === "duration"
                  ? formatSeconds(clamped)
                  : formatNumber(clamped)
              );
              commitCurrent();
              setWaveActive(false);
            }}
            placeholder={
              mode === "duration"
                ? "e.g. 2h 0m 0s or 120:00"
                : `e.g. ${prefix || ""}1,000${suffix || ""}`
            }
            disabled={disabled}
          />
        </div>

        {showCountButton ? (
          <Button
            className="w-full !border-white/5 rounded-none !bg-transparent hover:!bg-sidebar-accent py-3 text-xs"
            variant="outline"
            disabled={!histogramData || histogramData.length === 0}
            onClick={() =>
              onCountButtonClick?.([sliderValue[0]!, sliderValue[1]!])
            }
          >
            {countLabel
              ? countLabel(countInRange(sliderValue[0]!, sliderValue[1]!))
              : `Show ${countInRange(sliderValue[0]!, sliderValue[1]!)} items`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
