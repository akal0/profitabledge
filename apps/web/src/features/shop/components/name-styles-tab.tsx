import { useState } from "react";

import { AffiliateNameEffectText } from "@/features/public-proof/components/affiliate-name-effect-text";
import {
  NAME_COLOR_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_PRESETS,
} from "@/features/public-proof/lib/public-proof-badges";
import { CustomColorEditor } from "@/features/shop/components/custom-color-editor";
import { EffectCard } from "@/features/shop/components/effect-card";
import { SHOP_CARD_GRID_CLASS } from "@/features/shop/components/effect-grid";
import { ShopPaginationControls } from "@/features/shop/components/shop-pagination-controls";
import { ShopPreview } from "@/features/shop/components/shop-preview";
import type {
  ProfileEffectsState,
  ShopPreviewUser,
} from "@/features/shop/lib/shop-effects-catalog";
import {
  getNameColorTier,
  getNameEffectTier,
  getNameFontTier,
} from "@/features/shop/lib/shop-effects-catalog";

const PAGE_SIZE = 6;

type NameStylesTabProps = {
  user: ShopPreviewUser;
  draft: ProfileEffectsState;
  saved: ProfileEffectsState;
  preview: ProfileEffectsState;
  onUpdate: (patch: Partial<ProfileEffectsState>) => void;
  onPreviewChange: (patch: Partial<ProfileEffectsState> | null) => void;
};

function NameStylePreview({
  user,
  state,
  active = false,
}: {
  user: ShopPreviewUser;
  state: ProfileEffectsState;
  active?: boolean;
}) {
  const displayName = user.displayName ?? user.name ?? user.username ?? "Trader";

  return (
    <div className="flex min-h-[96px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.12))] px-3 text-center">
      <AffiliateNameEffectText
        nameFont={state.nameFont}
        nameEffect={state.nameEffect}
        nameColor={state.nameColor}
        customGradient={{
          from: state.customGradientFrom,
          to: state.customGradientTo,
        }}
        animateEffect={active}
        className="text-base"
      >
        {displayName}
      </AffiliateNameEffectText>
    </div>
  );
}

export function NameStylesTab({
  user,
  draft,
  saved,
  preview,
  onUpdate,
  onPreviewChange,
}: NameStylesTabProps) {
  const [hoveredPreviewKey, setHoveredPreviewKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const colorPageCount = Math.max(1, Math.ceil(NAME_COLOR_PRESETS.length / PAGE_SIZE));
  const colorPage = Math.min(pages.color ?? 0, colorPageCount - 1);
  const visibleColorPresets = NAME_COLOR_PRESETS.slice(
    colorPage * PAGE_SIZE,
    colorPage * PAGE_SIZE + PAGE_SIZE
  );
  const fontPageCount = Math.max(1, Math.ceil(NAME_FONT_PRESETS.length / PAGE_SIZE));
  const fontPage = Math.min(pages.font ?? 0, fontPageCount - 1);
  const visibleFontPresets = NAME_FONT_PRESETS.slice(
    fontPage * PAGE_SIZE,
    fontPage * PAGE_SIZE + PAGE_SIZE
  );
  const effectPageCount = Math.max(1, Math.ceil(NAME_EFFECT_PRESETS.length / PAGE_SIZE));
  const effectPage = Math.min(pages.effect ?? 0, effectPageCount - 1);
  const visibleEffectPresets = NAME_EFFECT_PRESETS.slice(
    effectPage * PAGE_SIZE,
    effectPage * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-md border border-white/5 bg-sidebar p-4">
          <div>
            <p className="text-sm font-medium text-white">Name Color</p>
            <p className="mt-1 text-sm text-white/42">
              Pick the palette that carries your display name across the product.
            </p>
          </div>
          <div className={SHOP_CARD_GRID_CLASS}>
            {visibleColorPresets.map((preset) => (
              <EffectCard
                key={preset.value}
                title={preset.label}
                collection="Color"
                tier={getNameColorTier(preset.value)}
                selected={draft.nameColor === preset.value}
                equipped={saved.nameColor === preset.value}
                onClick={() => onUpdate({ nameColor: preset.value })}
                onMouseEnter={() => {
                  setHoveredPreviewKey(`color:${preset.value}`);
                  onPreviewChange({ nameColor: preset.value });
                }}
                onMouseLeave={() => {
                  setHoveredPreviewKey(null);
                  onPreviewChange(null);
                }}
              >
                <NameStylePreview
                  user={user}
                  state={{ ...draft, nameColor: preset.value }}
                  active={hoveredPreviewKey === `color:${preset.value}`}
                />
              </EffectCard>
            ))}
          </div>
          <ShopPaginationControls
            page={colorPage}
            pageCount={colorPageCount}
            onPageChange={(nextPage) =>
              setPages((current) => ({ ...current, color: nextPage }))
            }
          />
          {draft.nameColor === "custom" ? (
            <CustomColorEditor
              title="Custom Name Gradient"
              from={draft.customGradientFrom}
              to={draft.customGradientTo}
              onFromChange={(value) => onUpdate({ customGradientFrom: value })}
              onToChange={(value) => onUpdate({ customGradientTo: value })}
            />
          ) : null}
        </section>

        <section className="space-y-4 rounded-md border border-white/5 bg-sidebar p-4">
          <div>
            <p className="text-sm font-medium text-white">Name Font</p>
            <p className="mt-1 text-sm text-white/42">
              Choose the typographic voice that best matches your profile identity.
            </p>
          </div>
          <div className={SHOP_CARD_GRID_CLASS}>
            {visibleFontPresets.map((preset) => (
              <EffectCard
                key={preset.value}
                title={preset.label}
                collection="Font"
                tier={getNameFontTier(preset.value)}
                selected={draft.nameFont === preset.value}
                equipped={saved.nameFont === preset.value}
                onClick={() => onUpdate({ nameFont: preset.value })}
                onMouseEnter={() => {
                  setHoveredPreviewKey(`font:${preset.value}`);
                  onPreviewChange({ nameFont: preset.value });
                }}
                onMouseLeave={() => {
                  setHoveredPreviewKey(null);
                  onPreviewChange(null);
                }}
              >
                <NameStylePreview
                  user={user}
                  state={{ ...draft, nameFont: preset.value }}
                  active={hoveredPreviewKey === `font:${preset.value}`}
                />
              </EffectCard>
            ))}
          </div>
          <ShopPaginationControls
            page={fontPage}
            pageCount={fontPageCount}
            onPageChange={(nextPage) =>
              setPages((current) => ({ ...current, font: nextPage }))
            }
          />
        </section>

        <section className="space-y-4 rounded-md border border-white/5 bg-sidebar p-4">
          <div>
            <p className="text-sm font-medium text-white">Name Effect</p>
            <p className="mt-1 text-sm text-white/42">
              Add shimmer, motion, or a punchier animated treatment to the name.
            </p>
          </div>
          <div className={SHOP_CARD_GRID_CLASS}>
            {visibleEffectPresets.map((preset) => (
              <EffectCard
                key={preset.value}
                title={preset.label}
                collection="Effect"
                tier={getNameEffectTier(preset.value)}
                selected={draft.nameEffect === preset.value}
                equipped={saved.nameEffect === preset.value}
                onClick={() => onUpdate({ nameEffect: preset.value })}
                onMouseEnter={() => {
                  setHoveredPreviewKey(`effect:${preset.value}`);
                  onPreviewChange({ nameEffect: preset.value });
                }}
                onMouseLeave={() => {
                  setHoveredPreviewKey(null);
                  onPreviewChange(null);
                }}
              >
                <NameStylePreview
                  user={user}
                  state={{ ...draft, nameEffect: preset.value }}
                  active={hoveredPreviewKey === `effect:${preset.value}`}
                />
              </EffectCard>
            ))}
          </div>
          <ShopPaginationControls
            page={effectPage}
            pageCount={effectPageCount}
            onPageChange={(nextPage) =>
              setPages((current) => ({ ...current, effect: nextPage }))
            }
          />
        </section>
      </div>

      <ShopPreview
        user={user}
        profileEffects={preview}
        title="Name Style Preview"
        nameEffectInteraction="hover"
        caption="Blend color, font, and motion until the display name feels right."
      />
    </div>
  );
}
