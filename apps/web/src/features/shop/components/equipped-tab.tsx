import { ShopPreview } from "@/features/shop/components/shop-preview";
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
import type { ShopTab } from "@/features/shop/lib/shop-tabs";

type EquippedTabProps = {
  user: ShopPreviewUser;
  preview: ProfileEffectsState;
  onTabChange: (tab: ShopTab) => void;
  onReset: () => void;
};

const EQUIPPED_ROWS: Array<{
  label: string;
  tab: ShopTab;
  value: (effects: ProfileEffectsState) => string;
}> = [
  {
    label: "Avatar Effect",
    tab: "avatar-effects",
    value: (effects) => getAvatarEffectLabel(effects.pfpEffect),
  },
  {
    label: "Avatar Decoration",
    tab: "avatar-decorations",
    value: (effects) => getAvatarDecorationLabel(effects.avatarDecoration),
  },
  {
    label: "Profile Effect",
    tab: "profile-effects",
    value: (effects) => getBannerEffectLabel(effects.bannerEffect),
  },
  {
    label: "Name Color",
    tab: "name-styles",
    value: (effects) => getNameColorLabel(effects.nameColor),
  },
  {
    label: "Name Font",
    tab: "name-styles",
    value: (effects) => getNameFontLabel(effects.nameFont),
  },
  {
    label: "Name Effect",
    tab: "name-styles",
    value: (effects) => getNameEffectLabel(effects.nameEffect),
  },
  {
    label: "Theme",
    tab: "themes",
    value: (effects) => getThemeLabel(effects.theme),
  },
];

export function EquippedTab({
  user,
  preview,
  onTabChange,
  onReset,
}: EquippedTabProps) {
  return (
    <div className="space-y-6">
      <ShopPreview
        user={user}
        profileEffects={preview}
        title="Current Loadout"
        caption="This is the exact profile treatment that will show up right now."
        sticky={false}
        bannerEffectInteraction="hover"
      />

      <div className="rounded-md border border-white/5 bg-sidebar p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Equipped Summary</p>
            <p className="mt-1 text-sm text-white/42">
              Jump straight back into the category you want to tweak next.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-white/62 transition-colors hover:border-white/18 hover:bg-white/[0.05] hover:text-white"
          >
            Reset All
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EQUIPPED_ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[0.03] px-3 py-3"
            >
              <div>
                <p className="text-xs text-white/34">
                  {row.label}
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {row.value(preview)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTabChange(row.tab)}
                className="text-xs font-medium text-teal-300 transition-colors hover:text-teal-200"
              >
                Change
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
