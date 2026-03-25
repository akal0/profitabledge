import type { QueryClient } from "@tanstack/react-query";

export function invalidateGoalQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: [["goals"]],
    refetchType: "active",
  });
}
