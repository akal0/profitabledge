"use client";

import dynamic from "next/dynamic";

import type { PixiAvatarOverlayProps } from "@/features/shop/components/pixi-avatar-overlay-inner";

const PixiAvatarOverlayInner = dynamic(
  () =>
    import("@/features/shop/components/pixi-avatar-overlay-inner").then(
      (module) => module.PixiAvatarOverlayInner
    ),
  { ssr: false, loading: () => null }
);

export function PixiAvatarOverlay(props: PixiAvatarOverlayProps) {
  return <PixiAvatarOverlayInner {...props} />;
}
