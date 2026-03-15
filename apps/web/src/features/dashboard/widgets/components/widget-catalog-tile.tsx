"use client";

import type { ComponentType } from "react";
import type { WidgetType } from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetCardComponentProps } from "@/features/dashboard/widgets/lib/widget-card-registry";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export function WidgetCatalogTile({
  widgetType,
  span,
  isAtMaxLimit,
  maxWidgets,
  accountId,
  valueMode,
  currencyCode,
  cardComponent: CardComponent,
  onToggleWidget,
}: {
  widgetType: WidgetType;
  span: number;
  isAtMaxLimit: boolean;
  maxWidgets: number;
  accountId?: string;
  valueMode?: WidgetValueMode;
  currencyCode?: string;
  cardComponent: ComponentType<WidgetCardComponentProps>;
  onToggleWidget?: (type: WidgetType) => void;
}) {
  return (
    <div
      className={
        isAtMaxLimit
          ? "relative cursor-not-allowed opacity-25 transition-all duration-150"
          : "relative cursor-pointer opacity-50 transition-all duration-150 hover:opacity-100"
      }
      style={{ gridColumn: `span ${span} / span ${span}` }}
      onClick={() => {
        if (!isAtMaxLimit) onToggleWidget?.(widgetType);
      }}
    >
      {isAtMaxLimit ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="border border-white/10 bg-sidebar/90 px-3 py-1.5 text-xs font-medium text-white/80">
            Max {maxWidgets} widgets reached
          </div>
        </div>
      ) : null}
      <CardComponent
        accountId={accountId}
        isEditing
        valueMode={valueMode}
        currencyCode={currencyCode}
      />
    </div>
  );
}
