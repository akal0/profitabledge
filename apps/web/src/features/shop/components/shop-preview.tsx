import { useState } from "react";
import { useInView } from "react-intersection-observer";

import {
  AvatarEffectPreview,
  AvatarDecorationPreview,
  BannerEffectPreview,
} from "@/features/shop/components/shop-option-previews";
import {
  PublicProfilePreviewCard,
} from "@/features/growth/components/affiliate-profile-effects";
import {
  getAvatarDecorationLabel,
  getAvatarEffectLabel,
  getBannerEffectLabel,
  getNameColorLabel,
  getNameEffectLabel,
  getNameFontLabel,
  getThemeLabel,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";
import { cn } from "@/lib/utils";

type ShopPreviewProps = {
  user: ShopPreviewUser;
  profileEffects: ProfileEffectsState;
  title?: string;
  caption?: string;
  className?: string;
  sticky?: boolean;
  compact?: boolean;
  previewMode?: "full" | "avatar" | "avatar-decoration" | "banner";
  bannerEffectInteraction?: "always" | "hover" | "never";
  nameEffectInteraction?: "always" | "hover" | "never";
};

export function ShopPreview({
  user,
  profileEffects,
  title = "Live Preview",
  caption = "Hover or select an item to see how the profile updates in real time.",
  className,
  sticky = true,
  compact = false,
  previewMode = "full",
  bannerEffectInteraction = "never",
  nameEffectInteraction = "hover",
}: ShopPreviewProps) {
  const { ref: previewRef, inView } = useInView({
    threshold: 0.2,
    triggerOnce: false,
  });
  const [isHovered, setIsHovered] = useState(false);
  const shouldRenderBannerEffect =
    bannerEffectInteraction === "always"
      ? inView
      : bannerEffectInteraction === "hover"
      ? isHovered && inView
      : false;
  const shouldAnimateBannerEffect =
    bannerEffectInteraction === "always"
      ? inView
      : bannerEffectInteraction === "hover"
      ? isHovered && inView
      : false;
  const shouldAnimateNameEffect =
    nameEffectInteraction === "always"
      ? inView
      : nameEffectInteraction === "hover"
      ? isHovered && inView
      : false;

  return (
    <div
      ref={previewRef}
      className={cn(
        "space-y-4 rounded-md border border-white/5 bg-sidebar p-4",
        sticky && "xl:sticky xl:top-5",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm text-white/42">{caption}</p>
      </div>

      {previewMode === "avatar" ? (
        <div className="rounded-lg border border-white/5 bg-sidebar p-1">
          <div className="overflow-hidden rounded-sm ring ring-white/5 bg-white dark:bg-sidebar-accent">
            <AvatarEffectPreview
              user={user}
              profileEffects={profileEffects}
              active={isHovered && inView}
            />
          </div>
        </div>
      ) : null}

      {previewMode === "banner" ? (
        <div className="rounded-lg border border-white/5 bg-sidebar p-1">
          <div className="overflow-hidden rounded-sm ring ring-white/5 bg-white dark:bg-sidebar-accent">
            <BannerEffectPreview
              user={user}
              profileEffects={profileEffects}
              active={shouldRenderBannerEffect && shouldAnimateBannerEffect}
            />
          </div>
        </div>
      ) : null}

      {previewMode === "avatar-decoration" ? (
        <div className="rounded-lg border border-white/5 bg-sidebar p-1">
          <div className="overflow-hidden rounded-sm ring ring-white/5 bg-white dark:bg-sidebar-accent">
            <AvatarDecorationPreview
              user={user}
              profileEffects={profileEffects}
              active={isHovered && inView}
            />
          </div>
        </div>
      ) : null}

      {previewMode === "full" ? (
        <PublicProfilePreviewCard
          user={user}
          pfpEffect={profileEffects.pfpEffect}
          avatarDecoration={profileEffects.avatarDecoration}
          bannerEffect={profileEffects.bannerEffect}
          nameplate={profileEffects.nameplate}
          customRingEffect={profileEffects.customRingEffect}
          nameEffect={profileEffects.nameEffect}
          nameFont={profileEffects.nameFont}
          nameColor={profileEffects.nameColor}
          theme={profileEffects.theme}
          themeAccent={profileEffects.themeAccent}
          customGradient={{
            from: profileEffects.customGradientFrom,
            to: profileEffects.customGradientTo,
          }}
          customRing={{
            from: profileEffects.customRingFrom,
            to: profileEffects.customRingTo,
          }}
          customNameplate={{
            from: profileEffects.customNameplateFrom,
            to: profileEffects.customNameplateTo,
          }}
          customTheme={{
            from: profileEffects.customThemeFrom,
            to: profileEffects.customThemeTo,
            accent: profileEffects.themeAccent,
          }}
          compact={compact}
          animateAvatarRing={shouldAnimateNameEffect}
          renderAvatarDecoration={shouldAnimateNameEffect}
          animateNameEffect={shouldAnimateNameEffect}
          renderBannerEffect={shouldRenderBannerEffect}
          animateBannerEffect={shouldAnimateBannerEffect}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/48">
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Avatar: <span className="text-white/78">{getAvatarEffectLabel(profileEffects.pfpEffect)}</span>
        </div>
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Decoration: <span className="text-white/78">{getAvatarDecorationLabel(profileEffects.avatarDecoration)}</span>
        </div>
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Banner: <span className="text-white/78">{getBannerEffectLabel(profileEffects.bannerEffect)}</span>
        </div>
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Theme: <span className="text-white/78">{getThemeLabel(profileEffects.theme)}</span>
        </div>
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Name Color: <span className="text-white/78">{getNameColorLabel(profileEffects.nameColor)}</span>
        </div>
        <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Font: <span className="text-white/78">{getNameFontLabel(profileEffects.nameFont)}</span>
        </div>
        <div className="col-span-2 rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
          Name Effect: <span className="text-white/78">{getNameEffectLabel(profileEffects.nameEffect)}</span>
        </div>
      </div>
    </div>
  );
}
