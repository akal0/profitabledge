import { useMemo, useState, type ReactNode } from "react";

import { EffectCard } from "@/features/shop/components/effect-card";
import {
  EffectGrid,
  SHOP_CARD_GRID_CLASS,
} from "@/features/shop/components/effect-grid";
import type { FilterChipGroup } from "@/features/shop/components/filter-chips";
import { ShopPaginationControls } from "@/features/shop/components/shop-pagination-controls";
import { AvatarDecorationPreview } from "@/features/shop/components/shop-option-previews";
import { ShopPreview } from "@/features/shop/components/shop-preview";
import {
  AVATAR_DECORATION_CATALOG,
  type EffectTier,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";

type AvatarDecorationsTabProps = {
  user: ShopPreviewUser;
  draft: ProfileEffectsState;
  saved: ProfileEffectsState;
  preview: ProfileEffectsState;
  onUpdate: (patch: Partial<ProfileEffectsState>) => void;
  onPreviewChange: (patch: Partial<ProfileEffectsState> | null) => void;
};

const TIER_ORDER = ["free", "basic", "premium", "legendary"] as const;
const PAGE_SIZE = 6;

function formatTierLabel(tier: EffectTier) {
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

export function AvatarDecorationsTab({
  user,
  draft,
  saved,
  preview,
  onUpdate,
  onPreviewChange,
}: AvatarDecorationsTabProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("all");
  const [renderer, setRenderer] = useState("all");
  const [hoveredEffectKey, setHoveredEffectKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return AVATAR_DECORATION_CATALOG.filter((item) => {
      if (collection !== "all" && item.collection !== collection) return false;
      if (renderer !== "all" && item.renderer !== renderer) return false;
      if (!query) return true;

      return [item.label, item.description, item.collection, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [collection, renderer, search]);

  const sections = TIER_ORDER.map((tier) => {
    const items = filteredItems.filter((item) => item.tier === tier);
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const page = Math.min(pages[tier] ?? 0, pageCount - 1);
    const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    return items.length
      ? {
          key: tier,
          label: formatTierLabel(tier),
          description:
            tier === "free"
              ? "Starter-friendly overlays and clean treatments."
              : tier === "basic"
              ? "Lighter decorative layers that add polish without overwhelming the avatar."
              : tier === "premium"
              ? "Animated particle overlays rendered for the focused preview."
              : "High-impact finishes reserved for your most expressive setup.",
          count: items.length,
          content: (
            <>
              <div className={SHOP_CARD_GRID_CLASS}>
                {visibleItems.map((item) => (
                  <EffectCard
                    key={item.key}
                    title={item.label}
                    collection={`${formatTierLabel(item.tier)} • ${item.renderer}`}
                    tier={item.tier}
                    accent={item.accent}
                    selected={draft.avatarDecoration === item.key}
                    equipped={saved.avatarDecoration === item.key}
                    onClick={() => onUpdate({ avatarDecoration: item.key })}
                    onMouseEnter={() => {
                      setHoveredEffectKey(item.key);
                      onPreviewChange({ avatarDecoration: item.key });
                    }}
                    onMouseLeave={() => {
                      setHoveredEffectKey(null);
                      onPreviewChange(null);
                    }}
                  >
                    <AvatarDecorationPreview
                      user={user}
                      profileEffects={{ ...draft, avatarDecoration: item.key }}
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
        }
      : null;
  }).filter(Boolean) as Array<{
    key: string;
    label: string;
    description: string;
    count: number;
    content: ReactNode;
  }>;

  const filterGroups: FilterChipGroup[] = useMemo(
    () => [
      {
        label: "Collection",
        value: collection,
        onChange: setCollection,
        options: [
          { value: "all", label: "All" },
          ...Array.from(
            new Set(AVATAR_DECORATION_CATALOG.map((item) => item.collection))
          ).map((value) => ({ value, label: value })),
        ],
      },
      {
        label: "Renderer",
        value: renderer,
        onChange: setRenderer,
        options: [
          { value: "all", label: "All" },
          ...Array.from(
            new Set(AVATAR_DECORATION_CATALOG.map((item) => item.renderer))
          ).map((value) => ({ value, label: value })),
        ],
      },
    ],
    [collection, renderer]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <EffectGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search avatar decorations"
        filterGroups={filterGroups}
        activeFilterCount={[collection, renderer].filter((value) => value !== "all").length}
        onClearFilters={() => {
          setCollection("all");
          setRenderer("all");
        }}
        sections={sections}
        emptyTitle="No decorations match your filters"
        emptyCopy="Try another collection or renderer."
      />

      <ShopPreview
        user={user}
        profileEffects={preview}
        previewMode="avatar-decoration"
        title="Decoration Preview"
        nameEffectInteraction="hover"
        caption={
          draft.avatarDecoration === "none"
            ? "No decoration selected — browse below to pick one."
            : "The live preview runs the real overlay so you can judge the motion before equipping it."
        }
      />
    </div>
  );
}
