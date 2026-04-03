export const SHOP_TABS = [
  "avatar-effects",
  "avatar-decorations",
  "profile-effects",
  "name-styles",
  "themes",
  "equipped",
] as const;

export type ShopTab = (typeof SHOP_TABS)[number];

export function isShopTab(value: string | null): value is ShopTab {
  return value !== null && SHOP_TABS.includes(value as ShopTab);
}

export const SHOP_TAB_LABELS: Record<ShopTab, string> = {
  "avatar-effects": "Avatar Effects",
  "avatar-decorations": "Decorations",
  "profile-effects": "Profile Effects",
  "name-styles": "Name Styles",
  themes: "Themes",
  equipped: "Equipped",
};
