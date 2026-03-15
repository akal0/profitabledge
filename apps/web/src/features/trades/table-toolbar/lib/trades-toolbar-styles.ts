"use client";

import { cn } from "@/lib/utils";
import {
  toolbarFilterMenuActionButtonClass,
  toolbarFilterMenuCheckboxClass,
  toolbarFilterMenuCheckboxItemClass,
  toolbarFilterMenuContentClass,
  toolbarFilterMenuFooterClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuLabelClass,
  toolbarFilterMenuMainSeparatorClass,
  toolbarFilterMenuOptionRowClass,
  toolbarFilterMenuScrollableBodyClass,
  toolbarFilterMenuSectionTitleClass,
  toolbarFilterMenuSubContentClass,
  toolbarFilterMenuSubSeparatorClass,
  toolbarFilterMenuSurfaceClass,
  toolbarFilterMenuTriggerClass,
  toolbarSelectIconTriggerButtonClassName,
  toolbarSelectTriggerActiveButtonClassName,
  toolbarSelectTriggerButtonClassName,
} from "@/components/ui/filter-menu-styles";

export const badgeBaseClass = toolbarSelectTriggerButtonClassName;

export const tradesToolbarStyles = {
  badgeBaseClass,
  activeBadgeClass: toolbarSelectTriggerActiveButtonClassName,
  iconBadgeClass: toolbarSelectIconTriggerButtonClassName,
  filterMenuSurfaceClass: toolbarFilterMenuSurfaceClass,
  filterMenuContentClass: cn(
    toolbarFilterMenuContentClass,
    "w-[320px] -mr-[9px]"
  ),
  filterMenuSubContentClass: cn(
    toolbarFilterMenuSurfaceClass,
    "ml-4 overflow-visible p-0"
  ),
  filterMenuSectionTitleClass: toolbarFilterMenuSectionTitleClass,
  filterMenuMainSeparatorClass: toolbarFilterMenuMainSeparatorClass,
  filterMenuTriggerClass: toolbarFilterMenuTriggerClass,
  filterMenuLabelClass: toolbarFilterMenuLabelClass,
  filterMenuSubSeparatorClass: toolbarFilterMenuSubSeparatorClass,
  filterMenuOptionRowClass: toolbarFilterMenuOptionRowClass,
  filterMenuCheckboxClass: toolbarFilterMenuCheckboxClass,
  filterMenuActionButtonClass: toolbarFilterMenuActionButtonClass,
  filterMenuScrollableBodyClass: toolbarFilterMenuScrollableBodyClass,
  filterMenuFooterClass: toolbarFilterMenuFooterClass,
  selectMenuContentClass: cn(
    toolbarFilterMenuContentClass,
    "flex flex-col gap-1"
  ),
  selectMenuSubContentClass: toolbarFilterMenuSubContentClass,
  selectMenuItemClass: toolbarFilterMenuItemClass,
  selectMenuCheckboxItemClass: toolbarFilterMenuCheckboxItemClass,
} as const;
