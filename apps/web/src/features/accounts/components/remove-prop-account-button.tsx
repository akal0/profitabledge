"use client";

import { useMutation } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient } from "@/utils/trpc";

type RemovePropAccountButtonProps = {
  accountId: string;
  accountName?: string | null;
  className?: string;
  label?: string;
  title?: string;
  onRemoved?: () => void;
};

export function RemovePropAccountButton({
  accountId,
  accountName,
  className,
  label = "Back to broker",
  title = "Remove from prop tracker",
  onRemoved,
}: RemovePropAccountButtonProps) {
  const removeMutation = useMutation({
    mutationFn: () =>
      trpcClient.propFirms.removeFromAccount.mutate({
        accountId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();

      toast.success(
        accountName
          ? `${accountName} moved back to broker accounts.`
          : "Account moved back to broker accounts."
      );
      onRemoved?.();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to remove prop tracking");
    },
  });

  const handleClick = () => {
    const confirmed = window.confirm(
      `Remove ${
        accountName || "this account"
      } from prop tracking and move it back to broker accounts?`
    );

    if (!confirmed) return;
    removeMutation.mutate();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={removeMutation.isPending}
      title={title}
      className={cn(
        "h-7 rounded-sm ring-1 ring-white/10 bg-sidebar px-2 text-[10px] text-white/65 hover:bg-sidebar-accent hover:text-white ",
        className
      )}
    >
      <Undo2 className="size-2.5" />
      {removeMutation.isPending ? "Removing..." : label}
    </Button>
  );
}
