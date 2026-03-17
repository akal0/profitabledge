"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { queryClient, trpcClient } from "@/utils/trpc";
import type { AccountRecord } from "./account-section-shell";

export function DeleteAccountButton({
  account,
  onDeleted,
  open,
  onOpenChange,
  trigger,
}: {
  account: AccountRecord;
  onDeleted?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedOpen = open ?? internalOpen;
  const setResolvedOpen = onOpenChange ?? setInternalOpen;

  const deleteMutation = useMutation({
    mutationFn: async () =>
      trpcClient.accounts.delete.mutate({ accountId: account.id }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["connections"] }),
        queryClient.invalidateQueries({ queryKey: ["propFirms"] }),
      ]);
      toast.success("Account deleted");
      setResolvedOpen(false);
      onDeleted?.();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete account");
    },
  });

  return (
    <AlertDialog open={resolvedOpen} onOpenChange={setResolvedOpen}>
      {trigger === null ? null : (
        <AlertDialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-sm bg-sidebar px-2 text-xs text-white/35 ring-white/10 hover:text-rose-300"
              title="Delete account"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="rounded-md border border-white/10 bg-[#141417] p-0 shadow-2xl sm:max-w-md [&>button]:hidden">
        <AlertDialogHeader className="px-5 pt-5">
          <AlertDialogTitle className="text-sm font-medium text-white">
            Delete account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed text-white/45">
            This permanently removes{" "}
            <span className="text-white">{account.name}</span>, its trades, and
            any account-linked records. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-white/5 px-5 py-4 sm:justify-end">
          <AlertDialogCancel className="h-9 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-9 rounded-sm bg-rose-500 px-3 text-xs text-white hover:bg-rose-500/90"
            onClick={(event) => {
              event.preventDefault();
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
