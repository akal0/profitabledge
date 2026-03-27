"use client";

import { useEffect, useState } from "react";
import { Eye, GitFork, Globe2, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

export type EdgeForkSheetSubmit = {
  name: string;
  publicationMode: "private" | "library";
  publicStatsVisible: boolean;
};

type EdgeForkSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edgeName: string;
  defaultName: string;
  defaultPublicationMode?: "private" | "library";
  defaultPublicStatsVisible?: boolean;
  canPublishPublicFork?: boolean;
  helperText?: string | null;
  isPending?: boolean;
  onSubmit: (payload: EdgeForkSheetSubmit) => Promise<void> | void;
};

export function EdgeForkSheet({
  open,
  onOpenChange,
  edgeName,
  defaultName,
  defaultPublicationMode = "private",
  defaultPublicStatsVisible = true,
  canPublishPublicFork = true,
  helperText,
  isPending,
  onSubmit,
}: EdgeForkSheetProps) {
  const [name, setName] = useState(defaultName);
  const [publicationMode, setPublicationMode] = useState<"private" | "library">(
    defaultPublicationMode
  );
  const [publicStatsVisible, setPublicStatsVisible] = useState(
    defaultPublicStatsVisible
  );

  useEffect(() => {
    if (!open) {
      setName(defaultName);
      setPublicationMode(defaultPublicationMode);
      setPublicStatsVisible(defaultPublicStatsVisible);
    }
  }, [defaultName, defaultPublicationMode, defaultPublicStatsVisible, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/5 bg-sidebar sm:max-w-xl"
      >
        <SheetHeader className="border-b border-white/5 px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <GitFork className="size-4 text-primary" />
            Fork Edge
          </SheetTitle>
          <SheetDescription className="max-w-md text-xs leading-relaxed text-white/45">
            Create your own version of{" "}
            <span className="text-white/72">{edgeName}</span>. Start private or
            publish the fork directly to your Library.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6 text-xs">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/78">Fork details</p>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Edge name"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white/78">Visibility</p>
            <Select
              value={publicationMode}
              onValueChange={(value) =>
                setPublicationMode(value as "private" | "library")
              }
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <span className="flex items-center gap-2">
                    <Lock className="size-3.5" />
                    Private fork
                  </span>
                </SelectItem>
                <SelectItem value="library" disabled={!canPublishPublicFork}>
                  <span className="flex items-center gap-2">
                    <Globe2 className="size-3.5" />
                    Public Library fork
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {helperText ? (
              <p className="text-xs leading-relaxed text-white/45">
                {helperText}
              </p>
            ) : null}
          </div>

          {publicationMode === "library" ? (
            <div className="rounded-sm border border-white/6 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/78">
                    Public stats
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">
                    Choose whether your Library fork shows its public stats
                    immediately.
                  </p>
                </div>
                <Switch
                  checked={publicStatsVisible}
                  onCheckedChange={setPublicStatsVisible}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/5 text-[11px] text-white/75"
                >
                  <Eye className="size-3" />
                  {publicStatsVisible ? "Stats visible" : "Stats hidden"}
                </Badge>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              className="h-9 rounded-sm"
              disabled={isPending || !name.trim()}
              onClick={() =>
                void onSubmit({
                  name: name.trim(),
                  publicationMode,
                  publicStatsVisible,
                })
              }
            >
              {isPending ? "Forking..." : "Create fork"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
