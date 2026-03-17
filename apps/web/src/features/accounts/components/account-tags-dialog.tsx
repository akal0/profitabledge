"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { toast } from "sonner";

import { TagMultiSelect } from "@/components/tags/tag-multi-select";
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
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import type { AccountRecord } from "./account-section-shell";

export function AccountTagsDialog({ account }: { account: AccountRecord }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const { data: suggestedTags } = useQuery({
    ...trpcOptions.accounts.listTags.queryOptions(),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    setTags(Array.isArray(account.tags) ? account.tags : []);
  }, [account.tags, open]);

  const updateTagsMutation = useMutation({
    mutationFn: async (nextTags: string[]) =>
      trpcClient.accounts.updateTags.mutate({
        accountId: account.id,
        tags: nextTags,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account tags updated");
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update account tags");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-sm bg-sidebar px-2 text-xs text-white/35 ring-white/10 hover:text-white"
          title="Edit account tags"
        >
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-md border-white/10 bg-[#141417] p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-sm font-medium text-white">
            Account tags
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-white/45">
            Group accounts by desk, asset class, strategy, or portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2">
          <TagMultiSelect
            value={tags}
            suggestions={(suggestedTags as string[] | undefined) ?? []}
            placeholder="Add account tags"
            maxSelected={25}
            onChange={setTags}
          />
        </div>

        <DialogFooter className="border-t border-white/5 px-5 py-4 sm:justify-end">
          <Button
            variant="outline"
            className="h-9 rounded-sm border-white/10 bg-sidebar text-xs text-white/70 hover:bg-sidebar-accent"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-9 rounded-sm bg-white text-xs text-black hover:bg-white/90"
            onClick={() => updateTagsMutation.mutate(tags)}
            disabled={updateTagsMutation.isPending}
          >
            {updateTagsMutation.isPending ? "Saving..." : "Save tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
