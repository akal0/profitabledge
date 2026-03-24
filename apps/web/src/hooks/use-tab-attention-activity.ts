"use client";

import { useEffect } from "react";

import {
  startTabAttentionActivity,
  type TabAttentionActivityKey,
} from "@/stores/tab-attention";

export function useTabAttentionActivity(
  key: TabAttentionActivityKey,
  isActive: boolean
) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    return startTabAttentionActivity(key);
  }, [isActive, key]);
}
