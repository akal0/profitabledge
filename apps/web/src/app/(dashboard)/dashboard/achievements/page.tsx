"use client";

import { trpc } from "@/utils/trpc";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

export default function AchievementsPage() {
  if (!isPublicAlphaFeatureEnabled("community")) {
    return (
      <AlphaFeatureLocked
        feature="community"
        title="Achievements are held back in this alpha"
      />
    );
  }

  const { data, isLoading } = trpc.users.getAchievements.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading achievements...</div>
      </div>
    );
  }

  const achievements = data?.achievements || [];
  const earned = data && "earned" in data ? data.earned : 0;
  const total = data && "total" in data ? data.total : achievements.length;
  const progressPct = total > 0 ? (earned / total) * 100 : 0;

  return (
    <main className="p-6 space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
          <p className="text-muted-foreground">
            Track your trading milestones and earn badges
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold">{earned}/{total}</div>
            <div className="text-xs text-muted-foreground">Unlocked</div>
          </div>
          <div className="flex items-center justify-center size-12 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Trophy className="size-6 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {progressPct.toFixed(0)}% complete
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {achievements.map((achievement) => (
          <Card
            key={achievement.id}
            className={cn(
              "p-4 text-center transition-all border",
              achievement.earned
                ? "bg-sidebar border-amber-500/20 hover:border-amber-500/40"
                : "bg-sidebar/50 border-white/5 opacity-40 grayscale"
            )}
          >
            <div className="text-3xl mb-2">{achievement.icon}</div>
            <h3
              className={cn(
                "text-sm font-semibold mb-1",
                achievement.earned ? "text-white" : "text-white/50"
              )}
            >
              {achievement.name}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {achievement.description}
            </p>
            {achievement.earned && (
              <div className="mt-2 inline-flex items-center gap-1 text-[9px] text-amber-400 font-medium">
                <Trophy className="size-2.5" />
                Unlocked
              </div>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
