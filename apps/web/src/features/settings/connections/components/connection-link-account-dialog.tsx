"use client";

import { Link2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { AccountRow } from "@/features/settings/connections/lib/connection-types";

export function ConnectionLinkAccountDialog({
  openConnectionId,
  accounts,
  onClose,
  onLinkAccount,
}: {
  openConnectionId: string | null;
  accounts: AccountRow[] | undefined;
  onClose: () => void;
  onLinkAccount: (connectionId: string, accountId: string) => void;
}) {
  return (
    <Dialog open={!!openConnectionId} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Link2 className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Link Trading Account</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Choose which trading account to sync trades into.</p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>

          <Separator />

          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Accounts
            </h3>
          </div>
          <Separator />
          <div className="space-y-2 px-5 py-4">
            {accounts?.map((account) => (
              <button
                key={account.id}
                onClick={() =>
                  openConnectionId && onLinkAccount(openConnectionId, account.id)
                }
                className="flex w-full items-center justify-between rounded-sm border border-white/5 bg-sidebar-accent p-3 text-left transition-all hover:border-white/15 hover:bg-sidebar-accent/80"
              >
                <div>
                  <span className="text-sm font-medium text-white">
                    {account.name}
                  </span>
                  <span className="ml-2 text-xs text-white/40">
                    {account.broker}
                  </span>
                </div>
                <Link2 className="size-4 text-white/30" />
              </button>
            ))}

            {!accounts || accounts.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/40">
                No trading accounts found. Create one first.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
