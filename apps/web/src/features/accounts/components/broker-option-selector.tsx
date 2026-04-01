"use client";

import { memo, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BROKER_OPTIONS,
  SELECTABLE_BROKER_OPTIONS,
  findBrokerOption,
  getBrokerLabel,
  type BrokerOption,
} from "@/features/accounts/lib/account-metadata";
import { cn } from "@/lib/utils";

const SELECT_TRIGGER_BASE_CLASS_NAME =
  "ring-white/5 data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:ring-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md ring bg-transparent! px-3 py-2 text-xs whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer";

function sortOptions(options: BrokerOption[]) {
  return [...options].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

type BrokerMenuGroup = {
  key: string;
  label: string;
  options: BrokerOption[];
};

const MENU_GROUP_DEFINITIONS: Array<{
  key: BrokerMenuGroup["key"];
  label: BrokerMenuGroup["label"];
  category: BrokerOption["category"];
}> = [
  {
    key: "broker-cfd",
    label: "Brokers - CFD/Forex",
    category: "broker-cfd",
  },
  {
    key: "broker-futures",
    label: "Brokers - Futures",
    category: "broker-futures",
  },
  {
    key: "broker-crypto",
    label: "Brokers - Crypto",
    category: "broker-crypto",
  },
  {
    key: "prop-cfd",
    label: "Prop firms - CFD/Forex",
    category: "prop-cfd",
  },
  {
    key: "prop-futures",
    label: "Prop firms - Futures",
    category: "prop-futures",
  },
  {
    key: "prop-stocks",
    label: "Prop firms - Stocks/Options",
    category: "prop-stocks",
  },
  {
    key: "platform",
    label: "Platforms",
    category: "platform",
  },
];

function buildMenuGroups(options: BrokerOption[], includePlatforms: boolean) {
  return MENU_GROUP_DEFINITIONS.filter(
    (definition) => includePlatforms || definition.category !== "platform"
  )
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      options: sortOptions(
        options.filter((option) => option.category === definition.category)
      ),
    }))
    .filter((group) => group.options.length > 0);
}

const MENU_GROUPS = buildMenuGroups(SELECTABLE_BROKER_OPTIONS, false);
const MENU_GROUPS_WITH_PLATFORMS = buildMenuGroups(BROKER_OPTIONS, true);

function renderOption(
  option: BrokerOption,
  isSelected: boolean,
  onSelect: (value: string) => void
) {
  return (
    <DropdownMenuItem
      key={option.value}
      onSelect={() => onSelect(option.value)}
      className="gap-2"
    >
      <img
        src={option.image}
        alt={option.label}
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {isSelected ? <CheckIcon className="size-4" /> : null}
    </DropdownMenuItem>
  );
}

export const BrokerOptionSelector = memo(function BrokerOptionSelector({
  value,
  onValueChange,
  placeholder = "Select a broker or prop firm",
  className,
  includePlatforms = false,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
  includePlatforms?: boolean;
  options?: BrokerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  const selected = findBrokerOption(value, { includePlatforms }) ?? null;
  const menuGroups: BrokerMenuGroup[] = useMemo(() => {
    if (options) {
      return buildMenuGroups(options, includePlatforms);
    }

    return includePlatforms ? MENU_GROUPS_WITH_PLATFORMS : MENU_GROUPS;
  }, [includePlatforms, options]);

  const buttonLabel = selected
    ? selected.label
    : value
    ? getBrokerLabel(value)
    : placeholder;

  const hasSelection = Boolean(selected || value);

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setOpenGroupKey(null);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            SELECT_TRIGGER_BASE_CLASS_NAME,
            "w-full px-4",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <img
                src={selected.image}
                alt={selected.label}
                className="h-4 w-4 shrink-0 object-contain"
              />
            ) : null}
            <span
              className={cn(
                "truncate",
                !hasSelection ? "text-muted-foreground" : undefined
              )}
            >
              {buttonLabel}
            </span>
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-64"
      >
        {menuGroups.map((group) => (
          <DropdownMenuSub
            key={group.key}
            onOpenChange={(isOpen) => {
              setOpenGroupKey(isOpen ? group.key : null);
            }}
          >
            <DropdownMenuSubTrigger className="text-xs text-white/75">
              {group.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72 p-0">
              {openGroupKey === group.key ? (
                <ScrollArea
                  className="max-h-80"
                  onWheelCapture={(event) => event.stopPropagation()}
                >
                  <div className="p-1">
                    {group.options.map((option) =>
                      renderOption(
                        option,
                        option.value === selected?.value,
                        (nextValue) => {
                          onValueChange(nextValue);
                          setOpen(false);
                          setOpenGroupKey(null);
                        }
                      )
                    )}
                  </div>
                </ScrollArea>
              ) : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
