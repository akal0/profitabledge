import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AffiliateNameEffectText } from "@/features/public-proof/components/affiliate-name-effect-text";
import { AvatarRingEffect } from "@/features/shop/components/avatar-ring-effect";
import {
  getAffiliatePfpEffectClassName,
  getAffiliatePfpEffectStyle,
  getAffiliatePfpWrapperClassName,
  getCustomPfpAnimationClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import { PixiAvatarOverlay } from "@/features/shop/components/pixi-avatar-overlay";
import { ProfileBannerEffect } from "@/features/shop/components/profile-banner-effect";
import {
  resolveProfilePreviewTheme,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";
import { cn } from "@/lib/utils";

type PreviewProps = {
  user: ShopPreviewUser;
  profileEffects: ProfileEffectsState;
};

function AvatarSurface({
  user,
  profileEffects,
  decorationActive = false,
  ringActive = false,
}: PreviewProps & { decorationActive?: boolean; ringActive?: boolean }) {
  const displayName = user.displayName ?? user.name ?? user.username ?? "Trader";
  const showHolographic = profileEffects.avatarDecoration === "holographic_overlay";

  return (
    <div className="relative">
      <div
        className={cn(
          "inline-flex rounded-full",
          getAffiliatePfpWrapperClassName(profileEffects.pfpEffect)
        )}
      >
        <div className="relative isolate size-20">
          <Avatar
            className={cn(
              "size-20 rounded-full shadow-lg",
              profileEffects.pfpEffect !== "none"
                ? getAffiliatePfpEffectClassName(profileEffects.pfpEffect)
                : "ring-4 ring-black/20",
              profileEffects.pfpEffect === "custom" &&
                getCustomPfpAnimationClassName(profileEffects.customRingEffect)
            )}
            style={
              profileEffects.pfpEffect === "custom"
                ? getAffiliatePfpEffectStyle("custom", {
                    from: profileEffects.customRingFrom,
                    to: profileEffects.customRingTo,
                  })
                : undefined
            }
          >
            {user.image ? (
              <AvatarImage src={user.image} alt={displayName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-sidebar-accent text-lg font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {showHolographic ? (
            <div className="avatar-holographic-overlay pointer-events-none absolute inset-0 rounded-full" />
          ) : null}
          {decorationActive && profileEffects.avatarDecoration !== "none" ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <PixiAvatarOverlay effect={profileEffects.avatarDecoration} />
            </div>
          ) : null}
        </div>
      </div>
      <AvatarRingEffect effect={profileEffects.pfpEffect} compact animate={ringActive} />
    </div>
  );
}

export function AvatarEffectPreview({
  user,
  profileEffects,
  active = false,
}: PreviewProps & { active?: boolean }) {
  return (
    <div className="flex min-h-[132px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.14))] px-4 py-6">
      <AvatarSurface user={user} profileEffects={profileEffects} ringActive={active} />
    </div>
  );
}

export function AvatarDecorationPreview({
  user,
  profileEffects,
  active = false,
}: PreviewProps & { active?: boolean }) {
  return (
    <div className="flex min-h-[132px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.14))] px-4 py-6">
      <AvatarSurface
        user={user}
        profileEffects={profileEffects}
        decorationActive={active}
        ringActive={active}
      />
    </div>
  );
}

export function BannerEffectPreview({
  user,
  profileEffects,
  active = false,
}: PreviewProps & { active?: boolean }) {
  const previewTheme = resolveProfilePreviewTheme(profileEffects);

  return (
    <div className="relative min-h-[132px] overflow-hidden bg-sidebar-accent">
      <div
        className="absolute inset-0"
        style={!user.bannerUrl ? { backgroundImage: previewTheme.banner } : undefined}
      >
        {user.bannerUrl ? (
          <img
            src={user.bannerUrl}
            alt="Banner preview"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: user.bannerPosition ?? "50% 50%" }}
          />
        ) : null}
      </div>
      {active ? (
        <ProfileBannerEffect effect={profileEffects.bannerEffect} compact animate />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}

export function NameplateOptionPreview({ user, profileEffects }: PreviewProps) {
  const displayName = user.displayName ?? user.name ?? user.username ?? "Trader";

  return (
    <div className="flex min-h-[132px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.12))] px-4 py-6 text-center">
      <AffiliateNameEffectText
        nameFont="default"
        nameEffect="none"
        nameColor="default"
        nameplate={profileEffects.nameplate}
        customNameplate={{
          from: profileEffects.customNameplateFrom,
          to: profileEffects.customNameplateTo,
        }}
        className="text-base text-white"
      >
        {displayName}
      </AffiliateNameEffectText>
    </div>
  );
}
