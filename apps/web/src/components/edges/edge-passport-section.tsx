"use client";

import Link from "next/link";
import {
  Building2,
  GitFork,
  ListChecks,
  ShieldCheck,
  Target,
  UsersRound,
  Waypoints,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { EdgeMetricCard } from "@/components/edges/edge-page-primitives";
import { cn } from "@/lib/utils";

type PassportTone = "teal" | "blue" | "amber" | "rose" | "slate";

type PassportCard = {
  label: string;
  value: string;
  detail: string;
  tone: PassportTone;
};

type EdgePassport = {
  cards: {
    sample: PassportCard;
    proof: PassportCard;
    process: PassportCard;
    prop: PassportCard;
  };
  fitNotes: Array<{
    label: string;
    value: string;
  }>;
  lineage: {
    publicationLabel: string;
    forkCount: number;
    shareCount: number;
    source: {
      id: string;
      name: string;
      ownerName: string | null;
      ownerUsername: string | null;
    } | null;
  };
};

function getToneClasses(tone: PassportTone) {
  switch (tone) {
    case "teal":
      return {
        icon: "text-teal-300",
        badge: "ring-teal-400/20 bg-teal-400/8 text-teal-200",
      };
    case "blue":
      return {
        icon: "text-sky-300",
        badge: "ring-sky-400/20 bg-sky-400/8 text-sky-200",
      };
    case "amber":
      return {
        icon: "text-amber-300",
        badge: "ring-amber-400/20 bg-amber-400/8 text-amber-200",
      };
    case "rose":
      return {
        icon: "text-rose-300",
        badge: "ring-rose-400/20 bg-rose-400/8 text-rose-200",
      };
    default:
      return {
        icon: "text-white/55",
        badge: "",
      };
  }
}

export function EdgePassportSection({
  passport,
  className,
}: {
  passport: EdgePassport;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Target, card: passport.cards.sample },
          { icon: ShieldCheck, card: passport.cards.proof },
          { icon: ListChecks, card: passport.cards.process },
          { icon: Building2, card: passport.cards.prop },
        ].map(({ icon, card }) => {
          const tone = getToneClasses(card.tone);
          return (
            <EdgeMetricCard
              key={card.label}
              icon={icon}
              iconClassName={tone.icon}
              badgeClassName={tone.badge}
              label={card.label}
              value={card.value}
              detail={card.detail}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <GoalSurface className="w-full">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-teal-300" />
              <p className="text-sm font-medium text-white/80">Fit profile</p>
            </div>
            <GoalContentSeparator className="mb-4 mt-4" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {passport.fitNotes.map((note) => (
                <GoalSurface key={note.label} innerClassName="h-full overflow-hidden">
                  <div className="p-3">
                    <p className="text-xs font-medium text-white/52">
                      {note.label}
                    </p>
                    <GoalContentSeparator className="mb-3 mt-3" />
                    <p className="text-sm leading-5 text-white/72">
                      {note.value}
                    </p>
                  </div>
                </GoalSurface>
              ))}
            </div>
          </div>
        </GoalSurface>

        <GoalSurface className="w-full">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-teal-300" />
              <p className="text-sm font-medium text-white/80">Lineage</p>
            </div>
            <GoalContentSeparator className="mb-4 mt-4" />

            <div className="space-y-3">
              <GoalSurface innerClassName="overflow-hidden">
                <div className="p-3">
                  <p className="text-xs font-medium text-white/52">
                    Publication
                  </p>
                  <GoalContentSeparator className="mb-3 mt-3" />
                  <p className="text-sm text-white/72">
                    {passport.lineage.publicationLabel}
                  </p>
                </div>
              </GoalSurface>

              <GoalSurface innerClassName="overflow-hidden">
                <div className="p-3">
                  <p className="text-xs font-medium text-white/52">Origin</p>
                  <GoalContentSeparator className="mb-3 mt-3" />
                  {passport.lineage.source ? (
                    <div className="space-y-1">
                      <Link
                        href={`/dashboard/edges/${passport.lineage.source.id}`}
                        className="inline-flex text-sm font-medium text-teal-300 transition-colors hover:text-teal-200"
                      >
                        {passport.lineage.source.name}
                      </Link>
                      <p className="text-xs text-white/45">
                        {passport.lineage.source.ownerName
                          ? `Forked from ${passport.lineage.source.ownerName}`
                          : passport.lineage.source.ownerUsername
                          ? `Forked from @${passport.lineage.source.ownerUsername}`
                          : "Forked from an existing source Edge"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-white/72">Original edge</p>
                  )}
                </div>
              </GoalSurface>

              <div className="grid grid-cols-2 gap-3">
                <EdgeMetricCard
                  icon={GitFork}
                  label="Forks"
                  value={passport.lineage.forkCount}
                />
                <EdgeMetricCard
                  icon={UsersRound}
                  label="Shares"
                  value={passport.lineage.shareCount}
                />
              </div>
            </div>
          </div>
        </GoalSurface>
      </div>
    </div>
  );
}
