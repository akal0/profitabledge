"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  Globe2,
  Link2,
  MoreHorizontal,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AccountPublicProofDialog } from "@/features/accounts/components/account-public-proof-dialog";
import { AccountLinkConnectionDialog } from "@/features/accounts/components/account-link-connection-dialog";
import { AccountTagsDialog } from "@/features/accounts/components/account-tags-dialog";
import { DeleteAccountButton } from "@/features/accounts/components/delete-account-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import {
  HEADER_ICON_BUTTON_CLASS,
  type AccountRecord,
} from "./account-section-shell";

const ACCOUNT_ACTION_ITEM_CLASS =
  "cursor-pointer rounded-sm px-2 py-2 text-xs text-white/75 focus:bg-sidebar-accent/80 focus:text-white";
const ACCOUNT_ACTION_ICON_CLASS = "h-3.5 w-3.5 text-white/45";

export function AccountCardActionsMenu({
  account,
  className,
}: {
  account: AccountRecord;
  className?: string;
}) {
  const connectionsEnabled = isPublicAlphaFeatureEnabled("connections");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [publicProofOpen, setPublicProofOpen] = useState(false);
  const [linkConnectionOpen, setLinkConnectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: connections = [] } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
    enabled: connectionsEnabled,
  });
  const linkableConnections = connections.filter(
    (connection) => connection.accountId == null
  );

  const archiveMutation = useMutation({
    mutationFn: (input: { accountId: string; archive: boolean }) =>
      trpcClient.accounts.toggleArchive.mutate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account archived");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to archive account");
    },
  });

  const trackRecordMutation = useMutation({
    mutationFn: (input: { accountId: string }) =>
      trpcClient.accounts.generateTrackRecord.mutate(input),
    onSuccess: (data: any) => {
      const url = `${window.location.origin}/verified/${data.shareId}`;
      void navigator.clipboard.writeText(url);
      toast.success("Track record generated. Link copied to clipboard.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to generate track record");
    },
  });

  const linkConnectionMutation = useMutation({
    mutationFn: (connectionId: string) =>
      trpcClient.connections.linkAccount.mutate({
        connectionId,
        accountId: account.id,
      }),
    onSuccess: async () => {
      toast.success("Connection linked");
      setLinkConnectionOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({
          queryKey: trpcOptions.connections.list.queryOptions().queryKey,
        }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to link connection");
    },
  });

  return (
    <>
      <AccountTagsDialog
        account={account}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        trigger={null}
      />
      <AccountPublicProofDialog
        account={account}
        open={publicProofOpen}
        onOpenChange={setPublicProofOpen}
        trigger={null}
      />
      <AccountLinkConnectionDialog
        open={linkConnectionOpen}
        accountName={account.name}
        connections={linkableConnections}
        isLinking={linkConnectionMutation.isPending}
        onOpenChange={setLinkConnectionOpen}
        onLinkConnection={(connectionId) =>
          linkConnectionMutation.mutate(connectionId)
        }
      />
      <DeleteAccountButton
        account={account}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        trigger={null}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              HEADER_ICON_BUTTON_CLASS,
              "gap-1 px-2.5 text-white/55 hover:text-white",
              className
            )}
            title="Account actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 rounded-sm bg-sidebar p-1 ring-1 ring-white/10 border-none"
        >
          <DropdownMenuItem
            className={ACCOUNT_ACTION_ITEM_CLASS}
            onSelect={() =>
              trackRecordMutation.mutate({ accountId: account.id })
            }
            disabled={trackRecordMutation.isPending}
          >
            <ShieldCheck className={ACCOUNT_ACTION_ICON_CLASS} />
            <span>
              {trackRecordMutation.isPending ? "Generating..." : "Track record"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={ACCOUNT_ACTION_ITEM_CLASS}
            onSelect={() => setTagsOpen(true)}
          >
            <Tag className={ACCOUNT_ACTION_ICON_CLASS} />
            <span>Account tags</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={ACCOUNT_ACTION_ITEM_CLASS}
            onSelect={() => setPublicProofOpen(true)}
          >
            <Globe2 className={ACCOUNT_ACTION_ICON_CLASS} />
            <span>Public proof page</span>
          </DropdownMenuItem>
          {connectionsEnabled ? (
            <DropdownMenuItem
              className={ACCOUNT_ACTION_ITEM_CLASS}
              onSelect={() => setLinkConnectionOpen(true)}
            >
              <Link2 className={ACCOUNT_ACTION_ICON_CLASS} />
              <span>Link connection</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator className="-mx-1 my-1 bg-white/5" />
          <DropdownMenuItem
            className={ACCOUNT_ACTION_ITEM_CLASS}
            onSelect={() =>
              archiveMutation.mutate({ accountId: account.id, archive: true })
            }
            disabled={archiveMutation.isPending}
          >
            <Archive className={ACCOUNT_ACTION_ICON_CLASS} />
            <span>
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              ACCOUNT_ACTION_ITEM_CLASS,
              "text-rose-200 focus:text-rose-100"
            )}
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-300" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
