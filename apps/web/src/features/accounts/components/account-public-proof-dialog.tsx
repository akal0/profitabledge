"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Copy,
  Globe2,
  Link2,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { AccountRecord } from "./account-section-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";

const SURFACE_CLASS =
  "rounded-md border border-white/10 bg-[#141417] p-0 shadow-2xl";

function toAbsoluteUrl(path: string | null | undefined) {
  if (!path) return null;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function AccountPublicProofDialog({
  account,
}: {
  account: AccountRecord;
}) {
  const [open, setOpen] = useState(false);

  const statusQuery = useQuery({
    ...trpcOptions.proof.getOwnedShareStatus.queryOptions({
      accountId: account.id,
    }),
    enabled: open,
  });

  const shareStatus = statusQuery.data;
  const publicUrl = useMemo(
    () => toAbsoluteUrl(shareStatus?.activeShare?.path),
    [shareStatus?.activeShare?.path]
  );

  const refreshStatus = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpcOptions.proof.getOwnedShareStatus.queryOptions({
        accountId: account.id,
      }).queryKey,
    });
  };

  const createOrRotate = useMutation(
    trpcOptions.proof.createOrRotate.mutationOptions({
      onSuccess: async (data) => {
        await refreshStatus();
        const url = toAbsoluteUrl(data.path);
        if (url) {
          await navigator.clipboard.writeText(url);
          toast.success("Public proof link copied to clipboard.");
        } else {
          toast.success("Public proof link created.");
        }
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create public proof link");
      },
    })
  );

  const revoke = useMutation(
    trpcOptions.proof.revoke.mutationOptions({
      onSuccess: async () => {
        await refreshStatus();
        toast.success("Public proof link revoked.");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to revoke public proof link");
      },
    })
  );

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Public proof link copied.");
  };

  const isBusy = createOrRotate.isPending || revoke.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-sm ring-white/10 bg-sidebar px-2 text-xs text-white/35 hover:bg-sidebar hover:text-teal-300"
          title="Manage public proof page"
        >
          <Globe2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(SURFACE_CLASS, "sm:max-w-lg [&>button]:hidden")}
      >
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-sm font-medium text-white">
            Public proof page
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-white/45">
            Share a live, revocable proof page for this account without exposing
            your internal account ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-md border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/80">{account.name}</p>
            <p className="mt-1 text-[11px] text-white/45">
              {account.broker} · Trades-first public proof page with trust
              signals
            </p>
          </div>

          {!shareStatus?.canCreate ? (
            <div className="flex gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="text-xs font-medium text-amber-200">
                  Set a username first
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-100/75">
                  Public proof links use your username in the URL. Add a
                  username in Settings before creating a link.
                </p>
              </div>
            </div>
          ) : null}

          {shareStatus?.activeShare ? (
            <div className="space-y-3 rounded-md border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/80">
                    Active link
                  </p>
                  <p className="mt-1 break-all text-[11px] text-white/50">
                    {publicUrl || shareStatus.activeShare.path}
                  </p>
                </div>
                <Badge className="rounded-sm ring-1 ring-teal-500/25 bg-teal-500/15 text-[10px] text-teal-300">
                  Live
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-white/45">
                <span>{shareStatus.activeShare.viewCount} views</span>
                <span>·</span>
                <span>
                  Created{" "}
                  {new Date(
                    shareStatus.activeShare.createdAt
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-white/75">
                No active public proof link
              </p>
              <p className="text-[11px] leading-relaxed text-white/45">
                Create a revocable URL in the format `/
                {shareStatus?.username || "username"}/account-slug/trades`.
              </p>
            </div>
          )}

          {shareStatus?.lastShare?.revokedAt ? (
            <p className="text-[11px] text-white/35">
              Last revoked{" "}
              {new Date(shareStatus.lastShare.revokedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-white/5 px-5 py-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
              onClick={() => createOrRotate.mutate({ accountId: account.id })}
              disabled={!shareStatus?.canCreate || isBusy}
            >
              {shareStatus?.activeShare ? (
                <>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Rotate link
                </>
              ) : (
                <>
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Create link
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
              onClick={handleCopy}
              disabled={!shareStatus?.activeShare || isBusy}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy link
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-sm border border-rose-500/20 bg-rose-500/10 px-3 text-xs text-rose-200 hover:bg-rose-500/15"
            onClick={() => revoke.mutate({ accountId: account.id })}
            disabled={!shareStatus?.activeShare || isBusy}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
