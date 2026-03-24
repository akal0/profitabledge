"use client";

import Link from "next/link";
import { ArrowUpRight, Settings2 } from "lucide-react";

import { settingsNavSections } from "@/components/settings-sidebar";

const SECTION_DESCRIPTIONS: Record<string, string> = {
  Account: "Profile, billing, broker, and workspace identity controls.",
  Trading: "Execution preferences, alerts, risk controls, and Edge-related settings.",
  Integrations: "Connections, AI preferences, and external platform wiring.",
  Developer: "API keys, notifications, diagnostics, and support tools.",
};

export default function SettingsPage() {
  const totalItems = settingsNavSections.reduce(
    (count, section) => count + section.items.length,
    0
  );

  return (
    <main className="space-y-6 p-6 py-4">
      <section className="rounded-xl border border-white/6 bg-sidebar/30 p-1">
        <div className="rounded-[10px] border border-white/6 bg-black/10 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm text-white/45">
                <Settings2 className="h-4 w-4 text-teal-300" />
                <span>Settings overview</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                Configure the platform from one place
              </h1>
              <p className="mt-2 text-sm text-white/45">
                Jump directly into the account, trading, integration, and
                developer controls that shape your workspace.
              </p>
            </div>
            <div className="rounded-lg border border-white/6 bg-white/5 px-4 py-3 text-right">
              <p className="text-xs text-white/40">Available settings</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {totalItems}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {settingsNavSections.map((section) => (
          <section
            key={section.label}
            className="rounded-xl border border-white/6 bg-sidebar/20 p-1"
          >
            <div className="rounded-[10px] border border-white/6 bg-black/10 px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {section.label}
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    {SECTION_DESCRIPTIONS[section.label] ??
                      "Workspace controls for this area."}
                  </p>
                </div>
                <span className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-white/55">
                  {section.items.length} pages
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-white/6 bg-white/5 px-3.5 py-3 transition-colors hover:bg-white/8"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/20 text-white/70">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {item.title}
                        </p>
                        <p className="text-xs text-white/40">
                          Open {item.title.toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/35" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
