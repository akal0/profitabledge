"use client";

import Link from "next/link";
import { Link2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ConnectionRow } from "@/features/settings/connections/lib/connection-types";

export function AccountLinkConnectionDialog({
  open,
  accountName,
  connections,
  isLinking,
  onOpenChange,
  onLinkConnection,
}: {
  open: boolean;
  accountName: string;
  connections: ConnectionRow[];
  isLinking: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkConnection: (connectionId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Link2 className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                Link connection
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Choose which sync connection should feed trades into{" "}
                <span className="text-white/65">{accountName}</span>.
              </p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>

          <Separator />

          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Available connections
            </h3>
          </div>
          <Separator />

          {connections.length > 0 ? (
            <div className="space-y-2 px-5 py-4">
              {connections.map((connection) => (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => onLinkConnection(connection.id)}
                  disabled={isLinking}
                  className="flex w-full items-center justify-between rounded-sm border border-white/5 bg-sidebar-accent p-3 text-left transition-all hover:border-white/15 hover:bg-sidebar-accent/80 disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      {connection.displayName}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {connection.provider}
                    </div>
                  </div>
                  <Link2 className="size-4 shrink-0 text-white/30" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-6">
              <p className="text-sm text-white/50">
                No unlinked connections are available right now.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/35">
                Add or manage broker connections in Settings, then come back to
                attach one to this account.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-4 h-8 rounded-sm border-white/10 bg-sidebar text-xs text-white/70 hover:bg-sidebar-accent hover:text-white"
              >
                <Link href="/dashboard/settings/connections">
                  Open connections
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
