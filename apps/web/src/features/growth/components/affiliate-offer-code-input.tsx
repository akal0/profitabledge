"use client";

import { BadgePercent } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AffiliateOfferCodeInput({
  value,
  onChange,
  helperText,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-4 shadow-sidebar-button",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <BadgePercent className="size-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Affiliate offer code
            </Label>
            <p className="mt-1 text-sm text-white/60">
              Apply an affiliate partner code before checkout.
            </p>
          </div>

          <Input
            value={value}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="h-10 border-white/10 bg-sidebar text-sm tracking-[0.14em] uppercase"
          />

          <p className="text-xs text-white/40">
            {helperText ??
              "If a partner link already attached you to an affiliate, conflicting codes will be rejected."}
          </p>
        </div>
      </div>
    </div>
  );
}
