import { useMemo, useState, type ReactNode } from "react";

import { CustomColorEditor } from "@/features/shop/components/custom-color-editor";
import { EffectCard } from "@/features/shop/components/effect-card";
import {
  EffectGrid,
  SHOP_CARD_GRID_CLASS,
} from "@/features/shop/components/effect-grid";
import type { FilterChipGroup } from "@/features/shop/components/filter-chips";
import { ShopPaginationControls } from "@/features/shop/components/shop-pagination-controls";
import { AvatarEffectPreview } from "@/features/shop/components/shop-option-previews";
import { ShopPreview } from "@/features/shop/components/shop-preview";
import {
  AVATAR_EFFECT_CATALOG,
  getAvatarEffectTier,
  type EffectTier,
  type ProfileEffectsState,
  type ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";
import { CUSTOM_RING_EFFECT_PRESETS } from "@/features/public-proof/lib/public-proof-badges";

type AvatarEffectsTabProps = {
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

export function AvatarEffectsTab({
  user,
  draft,
  saved,
  preview,
  onUpdate,
  onPreviewChange,
}: AvatarEffectsTabProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("all");
  const [colorFamily, setColorFamily] = useState("all");
  const [animationStyle, setAnimationStyle] = useState("all");
  const [hoveredEffectKey, setHoveredEffectKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return AVATAR_EFFECT_CATALOG.filter((item) => {
      if (collection !== "all" && item.collection !== collection) return false;
      if (colorFamily !== "all" && item.colorFamily !== colorFamily) return false;
      if (animationStyle !== "all" && item.animationStyle !== animationStyle)
        return false;
      if (!query) return true;

      return [item.label, item.collection, item.colorFamily, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [animationStyle, collection, colorFamily, search]);

  const groups = useMemo(
    () =>
      TIER_ORDER.map((tier) => {
        const items = filteredItems.filter((item) => getAvatarEffectTier(item.key) === tier);
        if (!items.length) return null;
        const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        const page = Math.min(pages[tier] ?? 0, pageCount - 1);
        const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        return {
          key: tier,
          label: getTierLabel(tier),
          description:
            tier === "free"
              ? "Core glow and ring styles that stay available to everyone."
              : tier === "basic"
              ? "Sharper ring treatments with more identity than the starter set."
              : tier === "premium"
              ? "Advanced motion and multi-layer ring systems."
              : "Signature ring effects that feel collectible and high-impact.",
          count: items.length,
          content: (
            <>
              <div className={SHOP_CARD_GRID_CLASS}>
                {visibleItems.map((item) => (
                  <EffectCard
                    key={item.key}
                    title={item.label}
                    collection={`${item.collection} • ${item.animationStyle}`}
                    tier={tier}
                    accent={item.accent}
                    selected={draft.pfpEffect === item.key}
                    equipped={saved.pfpEffect === item.key}
                    onClick={() => onUpdate({ pfpEffect: item.key })}
                    onMouseEnter={() => {
                      setHoveredEffectKey(item.key);
                      onPreviewChange({ pfpEffect: item.key });
                    }}
                    onMouseLeave={() => {
                      setHoveredEffectKey(null);
                      onPreviewChange(null);
                    }}
                  >
                    <AvatarEffectPreview
                      user={user}
                      profileEffects={{ ...draft, pfpEffect: item.key }}
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
      saved.pfpEffect,
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
          ...Array.from(new Set(AVATAR_EFFECT_CATALOG.map((item) => item.collection))).map(
            (value) => ({ value, label: value })
          ),
        ],
      },
      {
        label: "Color",
        value: colorFamily,
        onChange: setColorFamily,
        options: [
          { value: "all", label: "All" },
          ...Array.from(new Set(AVATAR_EFFECT_CATALOG.map((item) => item.colorFamily))).map(
            (value) => ({ value, label: value })
          ),
        ],
      },
      {
        label: "Motion",
        value: animationStyle,
        onChange: setAnimationStyle,
        options: [
          { value: "all", label: "All" },
          ...Array.from(
            new Set(AVATAR_EFFECT_CATALOG.map((item) => item.animationStyle))
          ).map((value) => ({ value, label: value })),
        ],
      },
    ],
    [animationStyle, collection, colorFamily]
  );

  const activeFilterCount = [collection, colorFamily, animationStyle].filter(
    (value) => value !== "all"
  ).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <EffectGrid
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search avatar effects"
          filterGroups={filterGroups}
          activeFilterCount={activeFilterCount}
          onClearFilters={() => {
            setCollection("all");
            setColorFamily("all");
            setAnimationStyle("all");
          }}
          sections={groups}
          emptyTitle="No effects match your filters"
          emptyCopy="Try another collection, color family, or motion style."
        />

        {draft.pfpEffect === "custom" ? (
          <CustomColorEditor
            title="Custom Avatar Effect"
            from={draft.customRingFrom}
            to={draft.customRingTo}
            onFromChange={(value) => onUpdate({ customRingFrom: value })}
            onToChange={(value) => onUpdate({ customRingTo: value })}
            extra={
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/55">Animation</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {CUSTOM_RING_EFFECT_PRESETS.map((preset) => {
                    const selected = draft.customRingEffect === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => onUpdate({ customRingEffect: preset.value })}
                        className={selected ? "rounded-full border border-teal-500/35 bg-teal-500/15 px-3 py-2 text-xs font-medium text-teal-200" : "rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/55 transition-colors hover:border-white/14 hover:bg-white/[0.05] hover:text-white/72"}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
          />
        ) : null}
      </div>

      <ShopPreview
        user={user}
        profileEffects={preview}
        previewMode="avatar"
        title="Avatar Preview"
        nameEffectInteraction="hover"
        caption={
          draft.pfpEffect === "none"
            ? "No effect selected — browse below to pick one."
            : "Compare how the ring, theme, and current name styling work together."
        }
      />
    </div>
  );
}
