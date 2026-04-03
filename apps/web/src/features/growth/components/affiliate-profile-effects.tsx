"use client";

import { memo, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Palette,
  Sparkles,
  Type,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalContentSeparator } from "@/components/goals/goal-surface";
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
} from "@/features/public-proof/lib/public-proof-badges";
import { AffiliateNameEffectText } from "@/features/public-proof/components/affiliate-name-effect-text";
import { AvatarRingEffect } from "@/features/shop/components/avatar-ring-effect";
import { PixiAvatarOverlay } from "@/features/shop/components/pixi-avatar-overlay";
import { ProfileBannerEffect } from "@/features/shop/components/profile-banner-effect";
import {
  normalizeProfileEffects,
  resolveProfilePreviewTheme,
} from "@/features/shop/lib/shop-effects-catalog";
import { trpcOptions } from "@/utils/trpc";

export interface ProfileEffectsProps {
  profileEffects?: {
    pfpEffect?: string;
    avatarDecoration?: string;
    bannerEffect?: string;
    nameplate?: string;
    nameEffect?: string;
    nameFont?: string;
    nameColor?: string;
    customGradientFrom?: string;
    customGradientTo?: string;
    customRingFrom?: string;
    customRingTo?: string;
    customRingEffect?: string;
    customNameplateFrom?: string;
    customNameplateTo?: string;
    theme?: string;
    customThemeFrom?: string;
    customThemeTo?: string;
    themeAccent?: string;
  } | null;
  user: {
    name?: string | null;
    displayName?: string | null;
    username?: string | null;
    image?: string | null;
    bannerUrl?: string | null;
    bannerPosition?: string | null;
  };
}

const OPTIONS_PER_PAGE = 3;
const FULL_PAGE_SEPARATOR_CLASS = "-mx-6! sm:-mx-8!";
const PREVIEW_OPTION_CARD_CLASS =
  "items-stretch gap-3 rounded-[22px] p-2.5 text-left";
const PREVIEW_OPTION_LABEL_CLASS =
  "px-1 pb-1 text-left text-xs font-medium text-white/72";
const SECTION_VISIBILITY_CLASS =
  "[content-visibility:auto] [contain-intrinsic-size:560px]";

function toRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(255,255,255,${alpha})`;
  }

  return `rgba(${r},${g},${b},${alpha})`;
}


function getOptionPageCount(items: readonly unknown[]) {
  return Math.max(1, Math.ceil(items.length / OPTIONS_PER_PAGE));
}

function getPageForValue<T extends { value: string }>(
  items: readonly T[],
  value?: string | null
) {
  const index = items.findIndex((item) => item.value === value);
  return index === -1 ? 0 : Math.floor(index / OPTIONS_PER_PAGE);
}

function getPaginatedItems<T>(items: readonly T[], page: number) {
  const safePage = Math.min(page, getOptionPageCount(items) - 1);
  const start = safePage * OPTIONS_PER_PAGE;
  return items.slice(start, start + OPTIONS_PER_PAGE);
}

const PFP_EFFECT_PAGE_COUNT = getOptionPageCount(PFP_EFFECT_PRESETS);
const RING_ANIMATION_PAGE_COUNT = getOptionPageCount(
  CUSTOM_RING_EFFECT_PRESETS
);
const NAME_COLOR_PAGE_COUNT = getOptionPageCount(NAME_COLOR_PRESETS);
const NAME_FONT_PAGE_COUNT = getOptionPageCount(NAME_FONT_PRESETS);
const NAME_EFFECT_PAGE_COUNT = getOptionPageCount(NAME_EFFECT_PRESETS);
const PREVIEW_PFP_EFFECT_SET: Set<string> = new Set(
  PFP_EFFECT_PRESETS.map((item) => item.value)
);
const PREVIEW_NAME_COLOR_SET: Set<string> = new Set(
  NAME_COLOR_PRESETS.map((item) => item.value)
);

function stripUppercaseAndTracking(className: string) {
  return className
    .split(" ")
    .filter(
      (token) =>
        token && token !== "uppercase" && !token.startsWith("tracking-")
    )
    .join(" ");
}

function PreviewSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn(
        "shimmer rounded-full bg-white/[0.08] animate-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    />
  );
}

export const PublicProfilePreviewCard = memo(function PublicProfilePreviewCard({
  user,
  pfpEffect,
  avatarDecoration,
  bannerEffect,
  nameplate,
  customRingEffect,
  nameEffect,
  nameFont,
  nameColor,
  theme,
  customNameplate,
  customTheme,
  themeAccent,
  customGradient,
  customRing,
  compact = false,
  animateAvatarRing = !compact,
  renderAvatarDecoration = !compact,
  renderBannerEffect = Boolean(bannerEffect && bannerEffect !== "none"),
  animateBannerEffect = !compact,
  animateNameEffect = !compact,
  toneKey,
  tonePalette,
  className,
}: {
  user: ProfileEffectsProps["user"];
  pfpEffect: string;
  avatarDecoration?: string;
  bannerEffect?: string;
  nameplate?: string;
  customRingEffect?: string;
  nameEffect: string;
  nameFont: string;
  nameColor: string;
  theme?: string;
  customNameplate?: { from: string; to: string };
  customTheme?: { from: string; to: string; accent?: string };
  themeAccent?: string;
  customGradient: { from: string; to: string };
  customRing: { from: string; to: string };
  compact?: boolean;
  animateAvatarRing?: boolean;
  renderAvatarDecoration?: boolean;
  renderBannerEffect?: boolean;
  animateBannerEffect?: boolean;
  animateNameEffect?: boolean;
  toneKey?: string;
  tonePalette?: { from?: string; to?: string } | null;
  className?: string;
}) {
  const displayName = user.displayName ?? user.name ?? user.username ?? "Trader";
  const previewUsername = user.username?.trim() || "trader";
  const imageLoading = compact ? "lazy" : "eager";
  const imageFetchPriority = compact ? "low" : "high";
  const showAvatarDecoration = Boolean(
    renderAvatarDecoration && avatarDecoration && avatarDecoration !== "none"
  );
  const showHolographicAvatar = avatarDecoration === "holographic_overlay";
  const themeKey = theme ?? "default";
  const holographicInteractive = !compact && bannerEffect === "holographic_card";
  const [tiltState, setTiltState] = useState({
    rotateX: 0,
    rotateY: 0,
    shineX: 50,
    shineY: 50,
  });
  const previewTheme = resolveProfilePreviewTheme(
    normalizeProfileEffects({
      pfpEffect:
        toneKey && PREVIEW_PFP_EFFECT_SET.has(toneKey)
          ? toneKey
          : toneKey && PREVIEW_NAME_COLOR_SET.has(toneKey)
          ? "none"
          : pfpEffect,
      bannerEffect,
      nameplate,
      nameEffect,
      nameFont,
      nameColor:
        toneKey && PREVIEW_NAME_COLOR_SET.has(toneKey) ? toneKey : nameColor,
      theme,
      customGradientFrom:
        toneKey === "custom" && nameColor === "custom"
          ? tonePalette?.from
          : customGradient.from,
      customGradientTo:
        toneKey === "custom" && nameColor === "custom"
          ? tonePalette?.to
          : customGradient.to,
      customRingFrom:
        toneKey === "custom" && pfpEffect === "custom"
          ? tonePalette?.from
          : customRing.from,
      customRingTo:
        toneKey === "custom" && pfpEffect === "custom"
          ? tonePalette?.to
          : customRing.to,
      customRingEffect,
      customNameplateFrom: customNameplate?.from,
      customNameplateTo: customNameplate?.to,
      customThemeFrom: customTheme?.from,
      customThemeTo: customTheme?.to,
      themeAccent: customTheme?.accent ?? themeAccent,
    })
  );
  const accentStrong = toRgba(previewTheme.accent, 0.36);
  const cardShellStyle = {
    transform: holographicInteractive
      ? `perspective(800px) rotateX(${tiltState.rotateX}deg) rotateY(${tiltState.rotateY}deg)`
      : undefined,
    transition: holographicInteractive ? "transform 160ms ease-out" : undefined,
  };

  const handleCardPointerMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!holographicInteractive) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTiltState({
      rotateX: (0.5 - py) * 8,
      rotateY: (px - 0.5) * 10,
      shineX: px * 100,
      shineY: py * 100,
    });
  };

  const handleCardPointerLeave = () => {
    if (!holographicInteractive) {
      return;
    }

    setTiltState({ rotateX: 0, rotateY: 0, shineX: 50, shineY: 50 });
  };

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-white/5 bg-sidebar p-1",
        compact ? "min-h-[176px]" : "min-h-[236px]",
        className
      )}
      onMouseMove={handleCardPointerMove}
      onMouseLeave={handleCardPointerLeave}
      style={cardShellStyle}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-sm ring ring-white/5",
          "bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250"
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden bg-sidebar-accent text-left",
            compact ? "min-h-[168px]" : "min-h-[228px]"
          )}
          style={{
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 60px ${toRgba(
              previewTheme.accent,
              compact ? 0.16 : 0.22
            )}`,
          }}
          >
            {themeKey === "cyberpunk" ? (
              <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(34,211,238,0.04)_0_1px,transparent_1px_7px),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.1),transparent_28%)]" />
            ) : null}
            {themeKey === "sakura" || themeKey === "rose_garden" ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,202,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.1),transparent_24%)]" />
            ) : null}
            {themeKey === "midnight" ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,0.08)_0_2px,transparent_3px),radial-gradient(circle_at_74%_28%,rgba(255,255,255,0.06)_0_2px,transparent_3px),radial-gradient(circle_at_82%_66%,rgba(129,140,248,0.12),transparent_22%)]" />
            ) : null}
            {themeKey === "volcanic" ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(239,68,68,0.12),transparent_26%)]" />
            ) : null}
            {themeKey === "arctic" ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,242,254,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.1),transparent_24%)]" />
            ) : null}
            {bannerEffect === "holographic_card" ? (
              <div
                className="pointer-events-none absolute inset-0 mix-blend-screen"
                style={{
                  background: `radial-gradient(circle at ${tiltState.shineX}% ${tiltState.shineY}%, rgba(255,255,255,0.22), transparent 18%), linear-gradient(115deg, transparent 18%, rgba(103,232,249,0.16) 34%, transparent 50%, rgba(244,114,182,0.14) 66%, rgba(251,191,36,0.12) 78%, transparent 88%)`,
                }}
              />
            ) : null}
            <div
              className={cn(
                "relative overflow-hidden border-b border-white/6",
              compact ? "h-24" : "h-36"
            )}
            style={
              !user.bannerUrl ? { backgroundImage: previewTheme.banner } : undefined
            }
          >
            {user.bannerUrl ? (
              <img
                src={user.bannerUrl}
                alt={`${displayName} banner`}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: user.bannerPosition ?? "50% 50%" }}
                loading={imageLoading}
                fetchPriority={imageFetchPriority}
                decoding="async"
                draggable={false}
              />
            ) : null}
            {renderBannerEffect ? (
              <ProfileBannerEffect
                effect={bannerEffect}
                compact={compact}
                animate={animateBannerEffect}
              />
            ) : null}
          </div>

          <div
            className={cn(
              "relative",
              compact ? "px-3 pb-3 pt-8" : "px-5 pb-5 pt-9"
            )}
          >
            <div
              className={cn(
                "absolute",
                compact ? "left-3 top-[-22px]" : "left-5 top-[-28px]"
              )}
            >
              <div
                className={cn(
                  "inline-flex rounded-full",
                  getAffiliatePfpWrapperClassName(pfpEffect)
                )}
              >
                <div
                  className={cn(
                    "relative isolate",
                    compact ? "size-12" : "size-16"
                  )}
                >
                  <Avatar
                    className={cn(
                      compact
                        ? "size-12 rounded-full shadow-lg"
                        : "size-16 rounded-full shadow-lg",
                      pfpEffect !== "none"
                        ? getAffiliatePfpEffectClassName(pfpEffect)
                        : "ring-4 ring-black/45",
                      pfpEffect === "custom" &&
                        getCustomPfpAnimationClassName(customRingEffect)
                    )}
                    style={
                      pfpEffect === "custom"
                        ? getAffiliatePfpEffectStyle("custom", customRing)
                        : undefined
                    }
                  >
                    {user.image ? (
                      <AvatarImage
                        src={user.image}
                        alt={displayName}
                        className="object-cover"
                        loading={imageLoading}
                        fetchPriority={imageFetchPriority}
                        decoding="async"
                        draggable={false}
                      />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "bg-sidebar-accent text-foreground font-semibold",
                        compact ? "text-sm" : "text-lg"
                      )}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {showAvatarDecoration && showHolographicAvatar ? (
                    <div className="avatar-holographic-overlay pointer-events-none absolute inset-0 rounded-full" />
                  ) : null}
                  {showAvatarDecoration && !showHolographicAvatar ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                      <PixiAvatarOverlay effect={avatarDecoration} />
                    </div>
                  ) : null}
                </div>
              </div>
              <AvatarRingEffect effect={pfpEffect} compact={compact} animate={animateAvatarRing} />
            </div>

            <div className={cn("space-y-3", compact ? "pt-1" : "pt-2")}>
              <div className="space-y-1">
                <div className={cn("text-white/92", compact ? "text-sm" : "text-lg")}>
                  <AffiliateNameEffectText
                    nameFont={nameFont}
                    nameEffect={nameEffect}
                    nameColor={nameColor}
                    nameplate={nameplate}
                    customGradient={nameColor === "custom" ? customGradient : null}
                    customNameplate={
                      nameplate === "custom" ? customNameplate ?? null : null
                    }
                    animateEffect={animateNameEffect}
                    fontClassTransform={stripUppercaseAndTracking}
                  >
                    {displayName}
                  </AffiliateNameEffectText>
                </div>
                <p
                  className={cn("text-white/45", compact ? "text-[10px]" : "text-xs")}
                >
                  Theme: {previewTheme.label}
                </p>
              </div>
              <p
                className={cn(
                  "pr-8 leading-4 text-white/50",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                <AffiliateNameEffectText
                  nameFont={nameFont}
                  nameEffect={nameEffect}
                  nameColor={nameColor}
                  nameplate={nameplate}
                  customGradient={nameColor === "custom" ? customGradient : null}
                    customNameplate={
                      nameplate === "custom" ? customNameplate ?? null : null
                    }
                    animateEffect={animateNameEffect}
                    fontClassTransform={stripUppercaseAndTracking}
                  >
                  @{previewUsername}'s
                </AffiliateNameEffectText>{" "}
                <span className="text-white/35">public proof page</span>
              </p>

              <div className="space-y-2">
                <PreviewSkeleton
                  className={compact ? "h-2.5 w-[30%]" : "h-4 w-52"}
                />
                <div className="flex items-center gap-2">
                  <PreviewSkeleton
                    className={compact ? "h-2.5 w-12" : "h-3 w-28"}
                  />
                  <PreviewSkeleton
                    className={compact ? "h-2.5 w-12" : "h-3 w-28"}
                  />
                  <PreviewSkeleton
                    className={compact ? "h-2.5 w-12" : "h-3 w-28"}
                  />
                  <PreviewSkeleton
                    className={compact ? "h-2.5 w-12" : "h-3 w-28"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 rounded-sm"
            style={{ boxShadow: `inset 0 0 0 1px ${accentStrong}` }}
          />
        </div>
      </div>
    </div>
  );
});

PublicProfilePreviewCard.displayName = "PublicProfilePreviewCard";

function PaginationControls({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-8 grid grid-cols-3 items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="flex h-8 w-8 cursor-pointer items-center justify-center justify-self-start rounded-sm border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="text-center text-[10px] text-white/32">
        Page {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount - 1}
        className="flex h-8 w-8 cursor-pointer items-center justify-center justify-self-end rounded-sm border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

function OptionCard({
  selected,
  label,
  onClick,
  children,
  className,
  labelClassName,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex cursor-pointer flex-col items-center gap-2 rounded-sm border p-3 text-center transition-colors",
        selected
          ? "border-teal-500/40 bg-teal-500/10"
          : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
        className
      )}
    >
      {selected && (
        <div className="absolute right-1.5 top-1.5">
          <Check className="size-3 text-teal-400" />
        </div>
      )}
      {children}
      <span className={cn("text-[10px] text-white/60", labelClassName)}>
        {label}
      </span>
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
  const [gradientFrom, setGradientFrom] = useState(
    saved.customGradientFrom ?? "#818cf8"
  );
  const [gradientTo, setGradientTo] = useState(
    saved.customGradientTo ?? "#f472b6"
  );
  const [ringFrom, setRingFrom] = useState(saved.customRingFrom ?? "#818cf8");
  const [ringTo, setRingTo] = useState(saved.customRingTo ?? "#f472b6");
  const [ringEffect, setRingEffect] = useState(
    saved.customRingEffect ?? "none"
  );
  const [pfpPage, setPfpPage] = useState(() =>
    getPageForValue(PFP_EFFECT_PRESETS, saved.pfpEffect ?? "none")
  );
  const [ringAnimationPage, setRingAnimationPage] = useState(() =>
    getPageForValue(
      CUSTOM_RING_EFFECT_PRESETS,
      saved.customRingEffect ?? "none"
    )
  );
  const [nameColorPage, setNameColorPage] = useState(() =>
    getPageForValue(NAME_COLOR_PRESETS, saved.nameColor ?? "default")
  );
  const [nameFontPage, setNameFontPage] = useState(() =>
    getPageForValue(NAME_FONT_PRESETS, saved.nameFont ?? "default")
  );
  const [nameEffectPage, setNameEffectPage] = useState(() =>
    getPageForValue(NAME_EFFECT_PRESETS, saved.nameEffect ?? "none")
  );

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
    setPfpPage(getPageForValue(PFP_EFFECT_PRESETS, saved.pfpEffect ?? "none"));
    setRingAnimationPage(
      getPageForValue(
        CUSTOM_RING_EFFECT_PRESETS,
        saved.customRingEffect ?? "none"
      )
    );
    setNameColorPage(
      getPageForValue(NAME_COLOR_PRESETS, saved.nameColor ?? "default")
    );
    setNameFontPage(
      getPageForValue(NAME_FONT_PRESETS, saved.nameFont ?? "default")
    );
    setNameEffectPage(
      getPageForValue(NAME_EFFECT_PRESETS, saved.nameEffect ?? "none")
    );
  }, [
    saved.pfpEffect,
    saved.nameEffect,
    saved.nameFont,
    saved.nameColor,
    saved.customGradientFrom,
    saved.customGradientTo,
    saved.customRingFrom,
    saved.customRingTo,
    saved.customRingEffect,
  ]);

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

  const stableUser = useMemo(
    () => ({
      name: user.name ?? null,
      displayName: user.displayName ?? null,
      username: user.username ?? null,
      image: user.image ?? null,
      bannerUrl: user.bannerUrl ?? null,
      bannerPosition: user.bannerPosition ?? null,
    }),
    [
      user.name,
      user.displayName,
      user.username,
      user.image,
      user.bannerUrl,
      user.bannerPosition,
    ]
  );
  const customGradient = useMemo(
    () => ({ from: gradientFrom, to: gradientTo }),
    [gradientFrom, gradientTo]
  );
  const customRing = useMemo(
    () => ({ from: ringFrom, to: ringTo }),
    [ringFrom, ringTo]
  );
  const visiblePfpPresets = useMemo(
    () => getPaginatedItems(PFP_EFFECT_PRESETS, pfpPage),
    [pfpPage]
  );
  const visibleRingAnimationPresets = useMemo(
    () => getPaginatedItems(CUSTOM_RING_EFFECT_PRESETS, ringAnimationPage),
    [ringAnimationPage]
  );
  const visibleNameColorPresets = useMemo(
    () => getPaginatedItems(NAME_COLOR_PRESETS, nameColorPage),
    [nameColorPage]
  );
  const visibleNameFontPresets = useMemo(
    () => getPaginatedItems(NAME_FONT_PRESETS, nameFontPage),
    [nameFontPage]
  );
  const visibleNameEffectPresets = useMemo(
    () => getPaginatedItems(NAME_EFFECT_PRESETS, nameEffectPage),
    [nameEffectPage]
  );

  const handleSave = () => {
    (saveEffects as any).mutate({
      pfpEffect,
      nameEffect,
      nameFont,
      nameColor,
      ...(nameColor === "custom"
        ? { customGradientFrom: gradientFrom, customGradientTo: gradientTo }
        : {}),
      ...(pfpEffect === "custom"
        ? {
            customRingFrom: ringFrom,
            customRingTo: ringTo,
            customRingEffect: ringEffect,
          }
        : {}),
    });
  };

  const hasChanges = useMemo(
    () =>
      pfpEffect !== (saved.pfpEffect ?? "none") ||
      nameEffect !== (saved.nameEffect ?? "none") ||
      nameFont !== (saved.nameFont ?? "default") ||
      nameColor !== (saved.nameColor ?? "default") ||
      (nameColor === "custom" &&
        (gradientFrom !== (saved.customGradientFrom ?? "#818cf8") ||
          gradientTo !== (saved.customGradientTo ?? "#f472b6"))) ||
      (pfpEffect === "custom" &&
        (ringFrom !== (saved.customRingFrom ?? "#818cf8") ||
          ringTo !== (saved.customRingTo ?? "#f472b6") ||
          ringEffect !== (saved.customRingEffect ?? "none"))),
    [
      pfpEffect,
      nameEffect,
      nameFont,
      nameColor,
      gradientFrom,
      gradientTo,
      ringFrom,
      ringTo,
      ringEffect,
      saved.pfpEffect,
      saved.nameEffect,
      saved.nameFont,
      saved.nameColor,
      saved.customGradientFrom,
      saved.customGradientTo,
      saved.customRingFrom,
      saved.customRingTo,
      saved.customRingEffect,
    ]
  );

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="rounded-sm border border-white/8 bg-black/20 p-6">
        <p className="mb-4 text-[10px] text-white/30">Preview</p>
        <PublicProfilePreviewCard
          user={stableUser}
          pfpEffect={pfpEffect}
          customRingEffect={ringEffect}
          nameEffect={nameEffect}
          nameFont={nameFont}
          nameColor={nameColor}
          customGradient={customGradient}
          customRing={customRing}
          tonePalette={
            pfpEffect === "custom"
              ? customRing
              : nameColor === "custom"
              ? customGradient
              : null
          }
          className="mx-auto max-w-[520px]"
        />
      </div>

      {/* PFP Effects */}
      <div className={cn("space-y-3", SECTION_VISIBILITY_CLASS)}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">
            Avatar effect
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePfpPresets.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={pfpEffect === preset.value}
              label={preset.label}
              onClick={() => setPfpEffect(preset.value)}
              className={PREVIEW_OPTION_CARD_CLASS}
              labelClassName={PREVIEW_OPTION_LABEL_CLASS}
            >
              <PublicProfilePreviewCard
                user={stableUser}
                pfpEffect={preset.value}
                customRingEffect={ringEffect}
                nameEffect={nameEffect}
                nameFont={nameFont}
                nameColor={nameColor}
                customGradient={customGradient}
                customRing={customRing}
                compact
                toneKey={preset.value}
                tonePalette={preset.value === "custom" ? customRing : null}
              />
            </OptionCard>
          ))}
        </div>
        <PaginationControls
          page={pfpPage}
          pageCount={PFP_EFFECT_PAGE_COUNT}
          onPageChange={setPfpPage}
        />

        {pfpEffect === "custom" && (
          <div className="mt-3 space-y-3 rounded-sm border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40">From</label>
                <input
                  type="color"
                  value={ringFrom}
                  onChange={(e) => setRingFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
                <span className="text-[10px] font-mono text-white/40">
                  {ringFrom}
                </span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40">To</label>
                <input
                  type="color"
                  value={ringTo}
                  onChange={(e) => setRingTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
                <span className="text-[10px] font-mono text-white/40">
                  {ringTo}
                </span>
              </div>
              <div
                className="ml-auto size-8 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${ringFrom}, ${ringTo})`,
                }}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-white/40">Animation</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {visibleRingAnimationPresets.map((preset) => (
                  <OptionCard
                    key={preset.value}
                    selected={ringEffect === preset.value}
                    label={preset.label}
                    onClick={() => setRingEffect(preset.value)}
                  />
                ))}
              </div>
              <PaginationControls
                page={ringAnimationPage}
                pageCount={RING_ANIMATION_PAGE_COUNT}
                onPageChange={setRingAnimationPage}
              />
            </div>
          </div>
        )}
      </div>

      <GoalContentSeparator className={FULL_PAGE_SEPARATOR_CLASS} />

      {/* Name Colors */}
      <div className={cn("space-y-3", SECTION_VISIBILITY_CLASS)}>
        <div className="flex items-center gap-2">
          <Palette className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">Name color</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleNameColorPresets.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameColor === preset.value}
              label={preset.label}
              onClick={() => setNameColor(preset.value)}
              className={PREVIEW_OPTION_CARD_CLASS}
              labelClassName={PREVIEW_OPTION_LABEL_CLASS}
            >
              <PublicProfilePreviewCard
                user={stableUser}
                pfpEffect={pfpEffect}
                customRingEffect={ringEffect}
                nameEffect={nameEffect}
                nameFont={nameFont}
                nameColor={preset.value}
                customGradient={customGradient}
                customRing={customRing}
                compact
                toneKey={preset.value}
                tonePalette={preset.value === "custom" ? customGradient : null}
              />
            </OptionCard>
          ))}
        </div>
        <PaginationControls
          page={nameColorPage}
          pageCount={NAME_COLOR_PAGE_COUNT}
          onPageChange={setNameColorPage}
        />

        {nameColor === "custom" && (
          <div className="mt-3 flex items-center gap-4 rounded-sm border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40">From</label>
              <div className="relative">
                <input
                  type="color"
                  value={gradientFrom}
                  onChange={(e) => setGradientFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
              </div>
              <span className="text-[10px] font-mono text-white/40">
                {gradientFrom}
              </span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40">To</label>
              <div className="relative">
                <input
                  type="color"
                  value={gradientTo}
                  onChange={(e) => setGradientTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0.5"
                />
              </div>
              <span className="text-[10px] font-mono text-white/40">
                {gradientTo}
              </span>
            </div>
            <div
              className="ml-auto h-4 w-16 rounded-sm"
              style={{
                background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
              }}
            />
          </div>
        )}
      </div>

      <GoalContentSeparator className={FULL_PAGE_SEPARATOR_CLASS} />

      {/* Name Fonts */}
      <div className={cn("space-y-3", SECTION_VISIBILITY_CLASS)}>
        <div className="flex items-center gap-2">
          <Type className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">Name font</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleNameFontPresets.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameFont === preset.value}
              label={preset.label}
              onClick={() => setNameFont(preset.value)}
              className={PREVIEW_OPTION_CARD_CLASS}
              labelClassName={PREVIEW_OPTION_LABEL_CLASS}
            >
              <PublicProfilePreviewCard
                user={stableUser}
                pfpEffect={pfpEffect}
                customRingEffect={ringEffect}
                nameEffect={nameEffect}
                nameFont={preset.value}
                nameColor={nameColor}
                customGradient={customGradient}
                customRing={customRing}
                compact
                tonePalette={nameColor === "custom" ? customGradient : null}
              />
            </OptionCard>
          ))}
        </div>
        <PaginationControls
          page={nameFontPage}
          pageCount={NAME_FONT_PAGE_COUNT}
          onPageChange={setNameFontPage}
        />
      </div>

      <GoalContentSeparator className={FULL_PAGE_SEPARATOR_CLASS} />

      {/* Name Effects */}
      <div className={cn("space-y-3", SECTION_VISIBILITY_CLASS)}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-white/50" />
          <span className="text-xs font-medium text-white/70">Name effect</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleNameEffectPresets.map((preset) => (
            <OptionCard
              key={preset.value}
              selected={nameEffect === preset.value}
              label={preset.label}
              onClick={() => setNameEffect(preset.value)}
              className={PREVIEW_OPTION_CARD_CLASS}
              labelClassName={PREVIEW_OPTION_LABEL_CLASS}
            >
              <PublicProfilePreviewCard
                user={stableUser}
                pfpEffect={pfpEffect}
                customRingEffect={ringEffect}
                nameEffect={preset.value}
                nameFont={nameFont}
                nameColor={nameColor}
                customGradient={customGradient}
                customRing={customRing}
                compact
                tonePalette={nameColor === "custom" ? customGradient : null}
              />
            </OptionCard>
          ))}
        </div>
        <PaginationControls
          page={nameEffectPage}
          pageCount={NAME_EFFECT_PAGE_COUNT}
          onPageChange={setNameEffectPage}
        />
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3">
        {hasChanges && (
          <span className="text-[10px] text-white/35">Unsaved changes</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveEffects.isPending}
          className={cn(
            "cursor-pointer flex h-9 w-max items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white ring ring-white/5 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
            !hasChanges && "hover:bg-sidebar hover:brightness-100"
          )}
        >
          {saveEffects.isPending ? "Saving..." : "Save effects"}
        </button>
      </div>
    </div>
  );
}
