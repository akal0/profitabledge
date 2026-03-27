"use client";

import Link from "next/link";
import { CircleDashed, GitFork, Network } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";

export type EdgeLineageNode = {
  id: string;
  name: string;
  ownerName?: string | null;
  publicationLabel?: string | null;
};

export type EdgeLineageData = {
  current: EdgeLineageNode;
  parent?: EdgeLineageNode | null;
  root?: EdgeLineageNode | null;
  descendants?: EdgeLineageNode[];
  forkCount?: number;
  shareCount?: number;
};

function LineageNodeCard({
  label,
  node,
}: {
  label: string;
  node: EdgeLineageNode;
}) {
  return (
    <GoalSurface innerClassName="h-full overflow-hidden">
      <div className="p-3">
        <p className="text-xs font-medium text-white/52">{label}</p>
        <GoalContentSeparator className="mb-3 mt-3" />
        <Link
          href={`/dashboard/edges/${node.id}`}
          className="inline-flex text-sm font-medium text-teal-300 transition-colors hover:text-teal-200"
        >
          {node.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
          {node.ownerName ? <span>{node.ownerName}</span> : null}
          {node.publicationLabel ? (
            <Badge
              variant="outline"
              className="ring-white/10 bg-white/5 text-[11px] text-white/75"
            >
              {node.publicationLabel}
            </Badge>
          ) : null}
        </div>
      </div>
    </GoalSurface>
  );
}

export function EdgeLineageGraph({
  lineage,
}: {
  lineage: EdgeLineageData | null;
}) {
  if (!lineage) {
    return (
      <GoalSurface className="w-full">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4 text-white/45" />
            <p className="text-sm font-medium text-white/78">Fork graph</p>
          </div>
          <GoalContentSeparator className="mb-4 mt-4" />
          <p className="text-sm text-white/45">
            Fork lineage will appear once this Edge has source or descendant
            relationships to map.
          </p>
        </div>
      </GoalSurface>
    );
  }

  return (
    <GoalSurface className="w-full">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-teal-300" />
            <p className="text-sm font-medium text-white/78">Fork graph</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="ring-white/10 bg-white/5 text-[11px] text-white/75">
              {lineage.forkCount ?? lineage.descendants?.length ?? 0} forks
            </Badge>
            <Badge variant="outline" className="ring-white/10 bg-white/5 text-[11px] text-white/75">
              {lineage.shareCount ?? 0} shares
            </Badge>
          </div>
        </div>

        <GoalContentSeparator className="mb-4 mt-4" />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {lineage.root ? <LineageNodeCard label="Root source" node={lineage.root} /> : null}
          {lineage.parent ? <LineageNodeCard label="Parent fork" node={lineage.parent} /> : null}
          <LineageNodeCard label="Current edge" node={lineage.current} />
        </div>

        <GoalSurface className="mt-4" innerClassName="overflow-hidden">
          <div className="p-3">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-teal-300" />
              <p className="text-sm font-medium text-white/80">Descendants</p>
            </div>
            <GoalContentSeparator className="mb-3 mt-3" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lineage.descendants?.length ? (
                lineage.descendants.map((descendant) => (
                  <LineageNodeCard
                    key={descendant.id}
                    label="Fork"
                    node={descendant}
                  />
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-white/45 md:col-span-2 xl:col-span-3">
                  No downstream forks are attached yet.
                </div>
              )}
            </div>
          </div>
        </GoalSurface>
      </div>
    </GoalSurface>
  );
}
