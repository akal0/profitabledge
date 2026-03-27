"use client";

import { useMemo } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

type PhaseOption = {
  order: number;
  name: string;
};

type PropDashboardLike = {
  account?: {
    propCurrentPhase?: number | null;
  } | null;
  challengeRule?: {
    phases?: unknown;
  } | null;
};

const ACTION_BUTTON_CLASS =
  "h-7 rounded-sm ring-white/10 bg-sidebar px-2 text-[10px] text-white/55 hover:bg-sidebar-accent hover:text-white gap-1";
const ACTION_ITEM_CLASS =
  "cursor-pointer rounded-sm px-2 py-2 text-xs text-white/75 focus:bg-sidebar-accent/80 focus:text-white";

function getPhaseOptions(dashboard?: PropDashboardLike): PhaseOption[] {
  const phases = Array.isArray(dashboard?.challengeRule?.phases)
    ? dashboard?.challengeRule?.phases
    : [];

  return phases
    .map((phase: any) => ({
      order: Number(phase?.order ?? 0),
      name:
        typeof phase?.name === "string" && phase.name.trim().length > 0
          ? phase.name.trim()
          : Number(phase?.order ?? 0) === 0
          ? "Funded"
          : `Phase ${Number(phase?.order ?? 1)}`,
    }))
    .sort((left, right) => {
      if (left.order === 0 && right.order !== 0) return 1;
      if (right.order === 0 && left.order !== 0) return -1;
      return left.order - right.order;
    });
}

export function PropAccountPhaseActionsMenu({
  accountId,
  accountName,
  dashboard,
  className,
}: {
  accountId: string;
  accountName: string;
  dashboard?: PropDashboardLike;
  className?: string;
}) {
  const phaseOptions = useMemo(() => getPhaseOptions(dashboard), [dashboard]);
  const currentPhase = dashboard?.account?.propCurrentPhase ?? null;
  const updatePhase = trpcClient.propFirms.updatePhase;

  const hasOptions = phaseOptions.length > 0;

  const handleSelectPhase = async (phase: PhaseOption) => {
    try {
      await updatePhase.mutate({
        accountId,
        newPhase: phase.order,
        status: phase.order === 0 ? "passed" : "active",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpcOptions.accounts.list.queryOptions().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: trpcOptions.propFirms.getTrackerDashboard.queryOptions({
            accountId,
          }).queryKey,
        }),
      ]);

      toast.success(`${accountName} moved to ${phase.name}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update phase");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(ACTION_BUTTON_CLASS, className)}
          disabled={!hasOptions}
        >
          Change phase
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-sm bg-sidebar p-1 ring-1 ring-white/10 border-none"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] text-white/35">
          Change phase
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1 bg-white/5" />
        {hasOptions ? (
          phaseOptions.map((phase) => {
            const isCurrent = phase.order === currentPhase;

            return (
              <DropdownMenuItem
                key={`${accountId}-${phase.order}`}
                className={ACTION_ITEM_CLASS}
                disabled={isCurrent}
                onSelect={() => {
                  void handleSelectPhase(phase);
                }}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span>{phase.name}</span>
                  {isCurrent ? (
                    <Check className="size-3.5 text-teal-300" />
                  ) : null}
                </div>
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem className={ACTION_ITEM_CLASS} disabled>
            <div className="flex items-center gap-2 text-white/45">
              <Loader2 className="size-3 animate-spin" />
              <span>No phase model</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
