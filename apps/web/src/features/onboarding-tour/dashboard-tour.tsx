"use client";

import { useEffect, useRef } from "react";
import { useOnborda } from "onborda";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcOptions } from "@/utils/trpc";
import { TOUR_ID } from "./tour-steps";

export function DashboardTour() {
  const { startOnborda, isOnbordaVisible } = useOnborda();
  const queryClient = useQueryClient();
  const hasStartedRef = useRef(false);
  const hasMarkedCompleteRef = useRef(false);

  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    staleTime: 5 * 60_000,
  });

  const { mutate: completeTour } = useMutation({
    ...trpcOptions.users.completeTour.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpcOptions.users.me.queryOptions().queryKey,
      });
    },
  });

  // Start tour once if the user hasn't seen it yet
  useEffect(() => {
    if (!me || me.hasSeenTour || hasStartedRef.current) return;
    hasStartedRef.current = true;
    const timer = setTimeout(() => {
      startOnborda(TOUR_ID);
    }, 800);
    return () => clearTimeout(timer);
  }, [me, startOnborda]);

  // Mark tour complete when it closes (whether finished or skipped)
  useEffect(() => {
    if (!isOnbordaVisible && hasStartedRef.current && !hasMarkedCompleteRef.current) {
      hasMarkedCompleteRef.current = true;
      completeTour();
    }
  }, [isOnbordaVisible, completeTour]);

  return null;
}
