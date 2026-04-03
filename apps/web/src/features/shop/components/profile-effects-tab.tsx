import { useMemo, useState, type ReactNode } from "react";

import { EffectCard } from "@/features/shop/components/effect-card";
import {
  EffectGrid,
  SHOP_CARD_GRID_CLASS,
} from "@/features/shop/components/effect-grid";
import type { FilterChipGroup } from "@/features/shop/components/filter-chips";
import { ShopPaginationControls } from "@/features/shop/components/shop-pagination-controls";
import { BannerEffectPreview } from "@/features/shop/components/shop-option-previews";
import { ShopPreview } from "@/features/shop/components/shop-preview";
import {
  BANNER_EFFECT_CATALOG,
  type EffectTier,
  getBannerEffectTier,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";

type ProfileEffectsTabProps = {
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

export function ProfileEffectsTab({
  user,
  draft,
  saved,
  preview,
  onUpdate,
  onPreviewChange,
}: ProfileEffectsTabProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("all");
  const [motion, setMotion] = useState("all");
  const [hoveredEffectKey, setHoveredEffectKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return BANNER_EFFECT_CATALOG.filter((item) => {
      if (collection !== "all" && item.collection !== collection) return false;
      if (motion !== "all" && item.motionStyle !== motion) return false;
      if (!query) return true;

      return [item.label, item.collection, item.colorFamily, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [collection, motion, search]);

  const sections = useMemo(
    () =>
      TIER_ORDER.map((tier) => {
        const items = filteredItems.filter((item) => getBannerEffectTier(item.key) === tier);
        if (!items.length) return null;
        const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        const page = Math.min(pages[tier] ?? 0, pageCount - 1);
        const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        return {
          key: tier,
          label: getTierLabel(tier),
          description:
            tier === "free"
              ? "Subtle atmospheric overlays that keep the card clean."
              : tier === "basic"
              ? "More expressive background motion and ambient treatments."
              : tier === "premium"
              ? "Animated banner effects with strong mood and identity."
              : "Signature profile effects built to feel event-worthy.",
          count: items.length,
          content: (
            <>
              <div className={SHOP_CARD_GRID_CLASS}>
                {visibleItems.map((item) => (
                  <EffectCard
                    key={item.key}
                    title={item.label}
                    collection={`${item.collection} • ${item.motionStyle}`}
                    tier={tier}
                    accent={item.accent}
                    selected={draft.bannerEffect === item.key}
                    equipped={saved.bannerEffect === item.key}
                    onClick={() => onUpdate({ bannerEffect: item.key })}
                    onMouseEnter={() => {
                      setHoveredEffectKey(item.key);
                      onPreviewChange({ bannerEffect: item.key });
                    }}
                    onMouseLeave={() => {
                      setHoveredEffectKey(null);
                      onPreviewChange(null);
                    }}
                  >
                    <BannerEffectPreview
                      user={user}
                      profileEffects={{ ...draft, bannerEffect: item.key }}
                      active={hoveredEffectKey === item.key}
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
    [
      draft,
      filteredItems,
      hoveredEffectKey,
      onPreviewChange,
      onUpdate,
      pages,
      saved.bannerEffect,
      user,
    ]
  );

  const filterGroups: FilterChipGroup[] = useMemo(
    () => [
      {
        label: "Collection",
        value: collection,
        onChange: setCollection,
        options: [
          { value: "all", label: "All" },
          ...Array.from(new Set(BANNER_EFFECT_CATALOG.map((item) => item.collection))).map(
            (value) => ({ value, label: value })
          ),
        ],
      },
      {
        label: "Motion",
        value: motion,
        onChange: setMotion,
        options: [
          { value: "all", label: "All" },
          ...Array.from(new Set(BANNER_EFFECT_CATALOG.map((item) => item.motionStyle))).map(
            (value) => ({ value, label: value })
          ),
        ],
      },
    ],
    [collection, motion]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <EffectGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search banner effects"
        filterGroups={filterGroups}
        activeFilterCount={[collection, motion].filter((value) => value !== "all").length}
        onClearFilters={() => {
          setCollection("all");
          setMotion("all");
        }}
        sections={sections}
        emptyTitle="No effects match your filters"
        emptyCopy="Try a different collection or motion style."
      />

      <ShopPreview
        user={user}
        profileEffects={preview}
        previewMode="banner"
        title="Banner Preview"
        bannerEffectInteraction="hover"
        caption={
          draft.bannerEffect === "none"
            ? "No effect selected — browse below to pick one."
            : "Hover a card or the preview to play the banner effect."
        }
      />
    </div>
  );
}
