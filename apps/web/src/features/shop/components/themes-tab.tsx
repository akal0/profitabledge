import { useMemo, useState, type ReactNode } from "react";

import { PublicProfilePreviewCard } from "@/features/growth/components/affiliate-profile-effects";
import { CustomColorEditor } from "@/features/shop/components/custom-color-editor";
import { EffectCard } from "@/features/shop/components/effect-card";
import {
  EffectGrid,
  SHOP_CARD_GRID_CLASS,
} from "@/features/shop/components/effect-grid";
import type { FilterChipGroup } from "@/features/shop/components/filter-chips";
import { ShopPaginationControls } from "@/features/shop/components/shop-pagination-controls";
import { ShopPreview } from "@/features/shop/components/shop-preview";
import {
  type EffectTier,
  getThemeTier,
  THEME_CATALOG,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";

type ThemesTabProps = {
  user: ShopPreviewUser;
  draft: ProfileEffectsState;
  saved: ProfileEffectsState;
  preview: ProfileEffectsState;
  onUpdate: (patch: Partial<ProfileEffectsState>) => void;
  onPreviewChange: (patch: Partial<ProfileEffectsState> | null) => void;
};

const TIER_ORDER = ["free", "basic", "premium", "legendary"] as const;
const PAGE_SIZE = 6;

function getTierLabel(tier: EffectTier) {
  switch (tier) {
    case "free":
      return "Free";
    case "basic":
      return "Basic";
    case "premium":
      return "Premium";
    case "legendary":
      return "Legendary";
  }
}

export function ThemesTab({
  user,
  draft,
  saved,
  preview,
  onUpdate,
  onPreviewChange,
}: ThemesTabProps) {
  const [search, setSearch] = useState("");
  const [mood, setMood] = useState("all");
  const [accentFamily, setAccentFamily] = useState("all");
  const [pages, setPages] = useState<Record<string, number>>({});

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return THEME_CATALOG.filter((item) => {
      if (mood !== "all" && item.mood !== mood) return false;
      if (accentFamily !== "all" && item.accentFamily !== accentFamily)
        return false;
      if (!query) return true;

      return [item.label, item.mood, item.accentFamily, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [accentFamily, mood, search]);

  const sections = useMemo(
    () =>
      TIER_ORDER.map((tier) => {
        const items = filteredItems.filter((item) => getThemeTier(item.key) === tier);
        if (!items.length) return null;
        const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        const page = Math.min(pages[tier] ?? 0, pageCount - 1);
        const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        return {
          key: tier,
          label: getTierLabel(tier),
          description:
            tier === "free"
              ? "Clean foundations that respect the rest of your equipped loadout."
              : tier === "basic"
              ? "Mood-forward themes with stronger palette identity."
              : tier === "premium"
              ? "Cinematic themes with richer atmosphere and styling cues."
              : "Statement themes built to feel like premium profile skins.",
          count: items.length,
          content: (
            <>
              <div className={SHOP_CARD_GRID_CLASS}>
                {visibleItems.map((item) => (
                  <EffectCard
                    key={item.key}
                    title={item.label}
                    collection={`${item.mood} • ${item.accentFamily}`}
                    tier={tier}
                    accent={item.accent}
                    selected={draft.theme === item.key}
                    equipped={saved.theme === item.key}
                    onClick={() =>
                      onUpdate({
                        theme: item.key,
                        themeAccent: item.accent,
                      })
                    }
                    onMouseEnter={() =>
                      onPreviewChange({ theme: item.key, themeAccent: item.accent })
                    }
                    onMouseLeave={() => onPreviewChange(null)}
                  >
                    <PublicProfilePreviewCard
                      user={user}
                      pfpEffect={draft.pfpEffect}
                      avatarDecoration={draft.avatarDecoration}
                      bannerEffect={draft.bannerEffect}
                      nameplate={draft.nameplate}
                      customRingEffect={draft.customRingEffect}
                      nameEffect={draft.nameEffect}
                      nameFont={draft.nameFont}
                      nameColor={draft.nameColor}
                      theme={item.key}
                      themeAccent={item.accent}
                      customGradient={{
                        from: draft.customGradientFrom,
                        to: draft.customGradientTo,
                      }}
                      customRing={{
                        from: draft.customRingFrom,
                        to: draft.customRingTo,
                      }}
                      customNameplate={{
                        from: draft.customNameplateFrom,
                        to: draft.customNameplateTo,
                      }}
                      customTheme={{
                        from: draft.customThemeFrom,
                        to: draft.customThemeTo,
                        accent: item.accent,
                      }}
                      compact
                      animateBannerEffect={false}
                    />
                  </EffectCard>
                ))}
              </div>
              <ShopPaginationControls
                page={page}
                pageCount={pageCount}
                onPageChange={(nextPage) =>
                  setPages((current) => ({ ...current, [tier]: nextPage }))
                }
              />
            </>
          ),
        };
      }).filter(Boolean) as Array<{
      key: string;
      label: string;
      description: string;
      count: number;
      content: ReactNode;
    }>,
    [draft, filteredItems, onPreviewChange, onUpdate, pages, saved.theme, user]
  );

  const filterGroups: FilterChipGroup[] = useMemo(
    () => [
      {
        label: "Mood",
        value: mood,
        onChange: setMood,
        options: [
          { value: "all", label: "All" },
          ...Array.from(new Set(THEME_CATALOG.map((item) => item.mood))).map(
            (value) => ({ value, label: value })
          ),
        ],
      },
      {
        label: "Accent",
        value: accentFamily,
        onChange: setAccentFamily,
        options: [
          { value: "all", label: "All" },
          ...Array.from(
            new Set(THEME_CATALOG.map((item) => item.accentFamily))
          ).map((value) => ({ value, label: value })),
        ],
      },
    ],
    [accentFamily, mood]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <EffectGrid
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search profile themes"
          filterGroups={filterGroups}
          activeFilterCount={[mood, accentFamily].filter((value) => value !== "all").length}
          onClearFilters={() => {
            setMood("all");
            setAccentFamily("all");
          }}
          sections={sections}
          emptyTitle="No themes match your filters"
          emptyCopy="Try another mood or accent family."
        />

        {draft.theme === "custom" ? (
          <CustomColorEditor
            title="Custom Theme"
            from={draft.customThemeFrom}
            to={draft.customThemeTo}
            accent={draft.themeAccent}
            onFromChange={(value) => onUpdate({ customThemeFrom: value })}
            onToChange={(value) => onUpdate({ customThemeTo: value })}
            onAccentChange={(value) => onUpdate({ themeAccent: value })}
          />
        ) : null}
      </div>

      <ShopPreview
        user={user}
        profileEffects={preview}
        title="Theme Preview"
        caption="Themes reshape the banner palette and accent mood without touching the rest of your loadout."
      />
    </div>
  );
}
