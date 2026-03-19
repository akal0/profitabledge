"use client";

import { useEffect, useRef } from "react";
import { useOnborda } from "onborda";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcOptions } from "@/utils/trpc";
import { TOUR_ID } from "./tour-steps";
import { useTourStore } from "./tour-store";

export function DashboardTour() {
  const { startOnborda, isOnbordaVisible } = useOnborda();
  const queryClient = useQueryClient();
  const hasStartedRef = useRef(false);
  const hasOpenedRef = useRef(false);
  const hasMarkedCompleteRef = useRef(false);
  const setIsStartingDashboardTour = useTourStore(
    (s) => s.setIsStartingDashboardTour
  );

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
    if (!me) return;

    if (me.hasSeenTour) {
      setIsStartingDashboardTour(false);
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    useTourStore.getState().setAddAccountSheetCompleted(false);
    setIsStartingDashboardTour(true);
    const frame = window.requestAnimationFrame(() => {
      startOnborda(TOUR_ID);
      useTourStore.getState().setIsStartingDashboardTour(false);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      setIsStartingDashboardTour(false);
    };
  }, [me, setIsStartingDashboardTour, startOnborda]);

  // Mark tour complete only after it has actually opened and then closes.
  useEffect(() => {
    if (isOnbordaVisible) {
      hasOpenedRef.current = true;
      return;
    }

    if (
      !hasOpenedRef.current ||
      hasMarkedCompleteRef.current
    ) {
      return;
    }

    if (!isOnbordaVisible) {
      hasMarkedCompleteRef.current = true;
      completeTour();
    }
  }, [isOnbordaVisible, completeTour]);

  return null;
}
