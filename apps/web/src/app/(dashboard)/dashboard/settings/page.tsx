"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Key,
  Plug,
  Settings2,
  TrendingUp,
  UserPen,
  type LucideIcon,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { settingsNavSections } from "@/components/settings-sidebar";

const SECTION_META: Record<
  string,
  {
    description: string;
    icon: LucideIcon;
    accentClassName: string;
  }
> = {
  Account: {
    description: "Profile, billing, broker, and workspace identity controls.",
    icon: UserPen,
    accentClassName: "text-sky-300",
  },
  Trading: {
    description:
      "Execution preferences, alerts, risk controls, and Edge-related settings.",
    icon: TrendingUp,
    accentClassName: "text-emerald-300",
  },
  Integrations: {
    description: "Connections, AI preferences, and external platform wiring.",
    icon: Plug,
    accentClassName: "text-amber-300",
  },
  Developer: {
    description: "API keys, notifications, diagnostics, and support tools.",
    icon: Key,
    accentClassName: "text-rose-300",
  },
};

export default function SettingsPage() {
  const totalItems = settingsNavSections.reduce(
    (count, section) => count + section.items.length,
    0
  );

  return (
    <main className="space-y-6 p-6 py-4">
      <GoalSurface>
        <div className="p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-teal-300" />
                <span className="text-xs text-white/50">
                  Settings overview
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                Configure the platform from one place
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/40">
                Jump directly into the account, trading, integration, and
                developer controls that shape your workspace.
              </p>
            </div>
            <div className="rounded-sm bg-white/5 px-4 py-3 text-right ring-1 ring-white/6">
              <p className="text-xs text-white/45">Available settings</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {totalItems}
              </p>
            </div>
          </div>
        </div>
      </GoalSurface>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {settingsNavSections.map((section) => {
          const meta = SECTION_META[section.label] ?? {
            description: "Workspace controls for this area.",
            icon: Settings2,
            accentClassName: "text-teal-300",
          };
          const SectionIcon = meta.icon;

          return (
            <GoalSurface key={section.label} className="h-full">
              <div className="flex h-full flex-col p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SectionIcon
                        className={`h-4 w-4 shrink-0 ${meta.accentClassName}`}
                      />
                      <span className="text-xs text-white/50">
                        {section.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/40">
                      {meta.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/55 ring-1 ring-white/6">
                    {section.items.length} pages
                  </span>
                </div>

                <GoalContentSeparator className="mb-3.5 mt-3.5" />

                <div className="grid gap-1.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between rounded-sm px-2.5 py-2.5 transition-colors hover:bg-white/5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white/5 ring-1 ring-white/6">
                          <item.icon className="h-4 w-4 text-white/65" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-white/35">
                            Open {item.title.toLowerCase()}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30 transition-colors hover:text-white/55" />
                    </Link>
                  ))}
                </div>
              </div>
            </GoalSurface>
          );
        })}
      </div>
    </main>
  );
}
