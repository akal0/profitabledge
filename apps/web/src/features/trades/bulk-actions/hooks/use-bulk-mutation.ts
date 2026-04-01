"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryClient } from "@/utils/trpc";

type UseBulkMutationOptions<TInput, TResult> = {
  errorMessage: string;
  mutationFn: (input: TInput) => Promise<TResult>;
  onSuccess?: (result: TResult) => void | Promise<void>;
  successMessage: (result: TResult) => string;
};

export function useBulkMutation<TInput, TResult>({
  errorMessage,
  mutationFn,
  onSuccess,
  successMessage,
}: UseBulkMutationOptions<TInput, TResult>) {
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [["trades"]] });
      await onSuccess?.(result);
      toast.success(successMessage(result));
    },
    onError: (error) => {
      console.error(errorMessage, error);
      toast.error(errorMessage);
    },
  });
}
