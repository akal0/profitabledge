"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Palette, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GoalContentSeparator,
} from "@/components/goals/goal-surface";
import { cn } from "@/lib/utils";
import {
  PFP_EFFECT_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_PRESETS,
  NAME_COLOR_PRESETS,
  getAffiliatePfpEffectClassName,
  getAffiliatePfpEffectStyle,
  getAffiliatePfpWrapperClassName,
  getCustomPfpAnimationClassName,
  CUSTOM_RING_EFFECT_PRESETS,
  getAffiliateNameColorStyle,
  getAffiliateNameFontClassName,
  getAffiliateNameEffectClassName,
  getAffiliateNameEffectStyle,
} from "@/features/public-proof/lib/public-proof-badges";
import { trpcOptions } from "@/utils/trpc";

export interface ProfileEffectsProps {
  profileEffects?: {
    pfpEffect?: string;
    nameEffect?: string;
    nameFont?: string;
    nameColor?: string;
    customGradientFrom?: string;
    customGradientTo?: string;
    customRingFrom?: string;
    customRingTo?: string;
    customRingEffect?: string;
  } | null;
  user: {
    name?: string | null;
    username?: string | null;
    image?: string | null;
  };
}

function OptionCard({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-sm border p-3 text-center transition-colors",
        selected
          ? "border-teal-500/40 bg-teal-500/10"
          : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      )}
    >
      {selected && (
        <div className="absolute right-1.5 top-1.5">
          <Check className="size-3 text-teal-400" />
        </div>
      )}
      {children}
      <span className="text-[10px] text-white/60">{label}</span>
    </button>
  );
}

export function ProfileEffectsEditor({
  profileEffects,
  user,
}: ProfileEffectsProps) {
  const saved = profileEffects ?? {};
  const [pfpEffect, setPfpEffect] = useState(saved.pfpEffect ?? "none");
  const [nameEffect, setNameEffect] = useState(saved.nameEffect ?? "none");
  const [nameFont, setNameFont] = useState(saved.nameFont ?? "default");
  const [nameColor, setNameColor] = useState(saved.nameColor ?? "default");
  const [gradientFrom, setGradientFrom] = useState(saved.customGradientFrom ?? "#818cf8");
  const [gradientTo, setGradientTo] = useState(saved.customGradientTo ?? "#f472b6");
  const [ringFrom, setRingFrom] = useState(saved.customRingFrom ?? "#818cf8");
  const [ringTo, setRingTo] = useState(saved.customRingTo ?? "#f472b6");
  const [ringEffect, setRingEffect] = useState(saved.customRingEffect ?? "none");

  // Sync local state when server data changes (e.g. after refetch)
  useEffect(() => {
    setPfpEffect(saved.pfpEffect ?? "none");
    setNameEffect(saved.nameEffect ?? "none");
    setNameFont(saved.nameFont ?? "default");
    setNameColor(saved.nameColor ?? "default");
    setGradientFrom(saved.customGradientFrom ?? "#818cf8");
    setGradientTo(saved.customGradientTo ?? "#f472b6");
    setRingFrom(saved.customRingFrom ?? "#818cf8");
    setRingTo(saved.customRingTo ?? "#f472b6");
    setRingEffect(saved.customRingEffect ?? "none");
  }, [saved.pfpEffect, saved.nameEffect, saved.nameFont, saved.nameColor, saved.customGradientFrom, saved.customGradientTo, saved.customRingFrom, saved.customRingTo, saved.customRingEffect]);

  const queryClient = useQueryClient();

  const saveEffects = useMutation({
    ...(trpcOptions as any).users.updateProfileEffects.mutationOptions(),
    onSuccess: () => {
      toast.success("Profile effects saved");
      void queryClient.invalidateQueries({
        queryKey: (trpcOptions as any).users.me.queryKey(),
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to save effects");
    },
  });

  const customGradient = { from: gradientFrom, to: gradientTo };
  const customRing = { from: ringFrom, to: ringTo };

  const handleSave = () => {
    (saveEffects as any).mutate({
      pfpEffect,
      nameEffect,
      nameFont,
      nameColor,
      ...(nameColor === "custom" ? { customGradientFrom: gradientFrom, customGradientTo: gradientTo } : {}),
      ...(pfpEffect === "custom" ? { customRingFrom: ringFrom, customRingTo: ringTo, customRingEffect: ringEffect } : {}),
    });
  };

  const hasChanges =
    pfpEffect !== (saved.pfpEffect ?? "none") ||
    nameEffect !== (saved.nameEffect ?? "none") ||
    nameFont !== (saved.nameFont ?? "default") ||
    nameColor !== (saved.nameColor ?? "default") ||
    (nameColor === "custom" && (gradientFrom !== (saved.customGradientFrom ?? "#818cf8") || gradientTo !== (saved.customGradientTo ?? "#f472b6"))) ||
    (pfpEffect === "custom" && (ringFrom !== (saved.customRingFrom ?? "#818cf8") || ringTo !== (saved.customRingTo ?? "#f472b6") || ringEffect !== (saved.customRingEffect ?? "none")));

  const displayName = user.username ?? user.name ?? "Trader";

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="rounded-sm border border-white/8 bg-black/20 p-6">
        <p className="mb-4 text-[10px] uppercase tracking-[0.16em] text-white/30">
          Preview
        </p>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "inline-flex rounded-full",
              getAffiliatePfpWrapperClassName(pfpEffect)
            )}
          >
            <Avatar
              className={cn(
                "size-16 rounded-full shadow-lg",
                pfpEffect !== "none"
                  ? getAffiliatePfpEffectClassName(pfpEffect)
                  : "ring-4 ring-sidebar",
                pfpEffect === "custom" && getCustomPfpAnimationClassName(ringEffect)
              )}
              style={pfpEffect === "custom" ? getAffiliatePfpEffectStyle("custom", customRing) : undefined}
            >
              {user.image ? (
                <AvatarImage
                  src={user.image}
                  alt={displayName}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-foreground text-lg font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <h3
              className={cn(
                "text-2xl font-semibold tracking-tight",
                getAffiliateNameFontClassName(nameFont),
                getAffiliateNameEffectClassName(nameEffect)
              )}
              style={{
                ...getAffiliateNameColorStyle(nameColor, nameColor === "custom" ? customGradient : null),
                ...getAffiliateNameEffectStyle(nameEffect, nameColor, nameColor === "custom" ? customGradient : null),
              }}
            >
              @{displayName}
            </h3>
            <p className="mt-0.5 text-xs text-white/40">
              Public proof page
            </p>
          </div>
        </div>
      </div>

      {/* PFP Effects */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">
            Avatar effect
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PFP_EFFECT_PRESETS.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={pfpEffect === preset.value}
              label={preset.label}
              onClick={() => setPfpEffect(preset.value)}
            >
              <div className={cn("size-8 rounded-full", preset.preview)} />
            </OptionCard>
          ))}
        </div>

        {pfpEffect === "custom" && (
          <div className="mt-3 space-y-3 rounded-sm border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-[0.12em] text-white/40">From</label>
                <input
                  type="color"
                  value={ringFrom}
                  onChange={(e) => setRingFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
                <span className="text-[10px] font-mono text-white/40">{ringFrom}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-[0.12em] text-white/40">To</label>
                <input
                  type="color"
                  value={ringTo}
                  onChange={(e) => setRingTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
                <span className="text-[10px] font-mono text-white/40">{ringTo}</span>
              </div>
              <div className="ml-auto size-8 rounded-full" style={{ background: `linear-gradient(135deg, ${ringFrom}, ${ringTo})` }} />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Animation</p>
              <div className="grid grid-cols-5 gap-2">
                {CUSTOM_RING_EFFECT_PRESETS.map((preset) => (
                  <OptionCard
                    key={preset.value}
                    selected={ringEffect === preset.value}
                    label={preset.label}
                    onClick={() => setRingEffect(preset.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <GoalContentSeparator />

      {/* Name Colors */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">Name color</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-11">
          {NAME_COLOR_PRESETS.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameColor === preset.value}
              label={preset.label}
              onClick={() => setNameColor(preset.value)}
            >
              <div className={cn("h-4 w-full rounded-sm", preset.swatch)} />
            </OptionCard>
          ))}
        </div>

        {nameColor === "custom" && (
          <div className="mt-3 flex items-center gap-4 rounded-sm border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-[0.12em] text-white/40">From</label>
              <div className="relative">
                <input
                  type="color"
                  value={gradientFrom}
                  onChange={(e) => setGradientFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
              </div>
              <span className="text-[10px] font-mono text-white/40">{gradientFrom}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-[0.12em] text-white/40">To</label>
              <div className="relative">
                <input
                  type="color"
                  value={gradientTo}
                  onChange={(e) => setGradientTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
              </div>
              <span className="text-[10px] font-mono text-white/40">{gradientTo}</span>
            </div>
            <div className="ml-auto h-4 w-16 rounded-sm" style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }} />
          </div>
        )}
      </div>

      <GoalContentSeparator />

      {/* Name Fonts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">Name font</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {NAME_FONT_PRESETS.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameFont === preset.value}
              label={preset.label}
              onClick={() => setNameFont(preset.value)}
            >
              <span className={cn("text-sm text-white/80", preset.className)}>
                Aa
              </span>
            </OptionCard>
          ))}
        </div>
      </div>

      <GoalContentSeparator />

      {/* Name Effects */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">
            Name effect
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {NAME_EFFECT_PRESETS.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameEffect === preset.value}
              label={preset.label}
              onClick={() => setNameEffect(preset.value)}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  getAffiliateNameEffectClassName(preset.value)
                )}
                style={{
                  ...getAffiliateNameColorStyle(nameColor, nameColor === "custom" ? customGradient : null),
                  ...getAffiliateNameEffectStyle(preset.value, nameColor, nameColor === "custom" ? customGradient : null),
                }}
              >
                Glow
              </span>
            </OptionCard>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveEffects.isPending}
          className={cn(
            "h-8 rounded-sm px-4 text-xs font-medium transition-colors",
            hasChanges
              ? "bg-teal-600 text-white hover:bg-teal-500"
              : "bg-white/5 text-white/30 cursor-not-allowed"
          )}
        >
          {saveEffects.isPending ? "Saving..." : "Save effects"}
        </button>
        {hasChanges && (
          <span className="text-[10px] text-white/35">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
