"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { AvatarDecorationsTab } from "@/features/shop/components/avatar-decorations-tab";
import { AvatarEffectsTab } from "@/features/shop/components/avatar-effects-tab";
import { EquippedTab } from "@/features/shop/components/equipped-tab";
import { NameStylesTab } from "@/features/shop/components/name-styles-tab";
import { ProfileEffectsTab } from "@/features/shop/components/profile-effects-tab";
import { ThemesTab } from "@/features/shop/components/themes-tab";
import {
  DEFAULT_PROFILE_EFFECTS,
  areProfileEffectsEqual,
  normalizeProfileEffects,
  toProfileEffectsInput,
} from "@/features/shop/lib/shop-effects-catalog";
import { SHOP_TABS, SHOP_TAB_LABELS, isShopTab, type ShopTab } from "@/features/shop/lib/shop-tabs";
import { trpcOptions } from "@/utils/trpc";

export function ShopTabs() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safePathname = pathname ?? "/dashboard/settings/shop";
  const activeTabValue = searchParams?.get("tab") ?? null;
  const activeTab: ShopTab = isShopTab(activeTabValue)
    ? activeTabValue
    : "avatar-effects";

  const { data: user, isLoading } = useQuery(trpcOptions.users.me.queryOptions());
  const [draft, setDraft] = useState(DEFAULT_PROFILE_EFFECTS);
  const [saved, setSaved] = useState(DEFAULT_PROFILE_EFFECTS);
  const [previewOverride, setPreviewOverride] = useState<
    Partial<typeof DEFAULT_PROFILE_EFFECTS> | null
  >(null);

  useEffect(() => {
    if (!user) return;
    const normalized = {
      ...normalizeProfileEffects(
      ((user as any).profileEffects as Record<string, unknown> | null) ?? null
      ),
      nameplate: DEFAULT_PROFILE_EFFECTS.nameplate,
    };
    setSaved(normalized);
    setDraft(normalized);
  }, [user]);

  const saveMutation = useMutation({
    ...trpcOptions.users.updateProfileEffects.mutationOptions(),
    onSuccess: (result) => {
      const normalized = {
        ...normalizeProfileEffects(
          (result.profileEffects as Record<string, unknown> | null) ?? null
        ),
        nameplate: DEFAULT_PROFILE_EFFECTS.nameplate,
      };
      setSaved(normalized);
      setDraft(normalized);
      void queryClient.invalidateQueries({
        queryKey: trpcOptions.users.me.queryOptions().queryKey,
      });
      toast.success("Shop loadout saved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile customizations");
    },
  });

  const preview = useMemo(
    () => ({ ...draft, ...(previewOverride ?? {}) }),
    [draft, previewOverride]
  );

  const hasChanges = !areProfileEffectsEqual(draft, saved);
  const userPreview = useMemo(
    () => ({
      name: user?.name ?? null,
      displayName: (user as any)?.displayName ?? null,
      username: user?.username ?? null,
      image: user?.image ?? null,
      bannerUrl: (user as any)?.profileBannerUrl ?? null,
      bannerPosition: (user as any)?.profileBannerPosition ?? null,
    }),
    [user]
  );

  const handleTabChange = (value: string) => {
    if (!isShopTab(value)) {
      return;
    }

    setPreviewOverride(null);

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "avatar-effects") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    const query = params.toString();
    router.replace(query ? `${safePathname}?${query}` : safePathname, {
      scroll: false,
    });
  };

  if (isLoading || !user) {
      return (
        <RouteLoadingFallback
          route="settings"
          message="Opening the customization shop and loading your profile..."
          animated={false}
        />
    );
  }

  return (
    <div className="flex w-full flex-col">
      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <p className="text-sm font-medium text-white/80">Profile shop</p>
          <p className="mt-0.5 text-xs text-white/40">
            Customize how your profile appears across proof surfaces and the app.
          </p>
        </div>
        <div className="rounded-md border border-white/5 bg-sidebar p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-white/80">
                Browse avatar effects, decorations, banner overlays, display name styles, and themes in one place.
              </p>
              <p className="mt-1 text-xs text-white/40">
                Changes save directly to your profile customization settings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasChanges ? (
                <span className="text-xs font-medium text-white/45">
                  Unsaved changes
                </span>
              ) : (
                <span className="text-xs text-white/28">All customizations saved</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setPreviewOverride(null);
                  setDraft(DEFAULT_PROFILE_EFFECTS);
                }}
                className="cursor-pointer flex h-9 w-max items-center justify-center gap-2 rounded-sm bg-white/[0.03] px-3 py-2 text-xs text-white ring ring-white/5 transition-all duration-250 hover:bg-white/[0.06] hover:brightness-110"
              >
                Reset all
              </button>
              <button
                type="button"
                disabled={!hasChanges || saveMutation.isPending}
                onClick={() => saveMutation.mutate(toProfileEffectsInput(draft) as any)}
                className="cursor-pointer flex h-9 w-max items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white ring ring-white/5 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto px-6 pt-4 sm:px-8">
          <TabsListUnderlined className="flex h-auto min-w-max items-stretch gap-5 border-b-0">
            {SHOP_TABS.map((tab) => (
              <TabsTriggerUnderlined
                key={tab}
                value={tab}
                className="h-10 pb-0 pt-0 text-xs font-medium"
              >
                {SHOP_TAB_LABELS[tab]}
              </TabsTriggerUnderlined>
            ))}
          </TabsListUnderlined>
        </div>
        <Separator />

        <TabsContent value="avatar-effects" className="mt-0 px-6 py-5 sm:px-8">
          <AvatarEffectsTab
            user={userPreview}
            draft={draft}
            saved={saved}
            preview={preview}
            onUpdate={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onPreviewChange={setPreviewOverride}
          />
        </TabsContent>

        <TabsContent value="profile-effects" className="mt-0 px-6 py-5 sm:px-8">
          <ProfileEffectsTab
            user={userPreview}
            draft={draft}
            saved={saved}
            preview={preview}
            onUpdate={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onPreviewChange={setPreviewOverride}
          />
        </TabsContent>

        <TabsContent value="avatar-decorations" className="mt-0 px-6 py-5 sm:px-8">
          <AvatarDecorationsTab
            user={userPreview}
            draft={draft}
            saved={saved}
            preview={preview}
            onUpdate={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onPreviewChange={setPreviewOverride}
          />
        </TabsContent>

        <TabsContent value="name-styles" className="mt-0 px-6 py-5 sm:px-8">
          <NameStylesTab
            user={userPreview}
            draft={draft}
            saved={saved}
            preview={preview}
            onUpdate={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onPreviewChange={setPreviewOverride}
          />
        </TabsContent>

        <TabsContent value="themes" className="mt-0 px-6 py-5 sm:px-8">
          <ThemesTab
            user={userPreview}
            draft={draft}
            saved={saved}
            preview={preview}
            onUpdate={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onPreviewChange={setPreviewOverride}
          />
        </TabsContent>

        <TabsContent value="equipped" className="mt-0 px-6 py-5 sm:px-8">
          <EquippedTab
            user={userPreview}
            preview={preview}
            onTabChange={handleTabChange}
            onReset={() => {
              setPreviewOverride(null);
              setDraft(DEFAULT_PROFILE_EFFECTS);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
