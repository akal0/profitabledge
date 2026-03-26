"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { trpcOptions } from "@/utils/trpc";
import { useState } from "react";
import {
  Copy,
  Check,
  Trash2,
  Key,
  Download,
  ExternalLink,
  X,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function APISettingsPage() {
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: apiKeys, refetch: refetchKeys } = useQuery(
    trpcOptions.apiKeys.list.queryOptions()
  );
  const generateKey = useMutation(
    trpcOptions.apiKeys.generate.mutationOptions()
  );
  const revokeKey = useMutation(trpcOptions.apiKeys.revoke.mutationOptions());
  const deleteKey = useMutation(trpcOptions.apiKeys.delete.mutationOptions());

  const handleGenerateKey = async () => {
    if (!newApiKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }

    try {
      const result = await generateKey.mutateAsync({
        name: newApiKeyName,
      });

      setGeneratedKey(result.key);
      setShowGenerateDialog(false);
      setShowKeyDialog(true);
      setNewApiKeyName("");
      refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate API key");
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    toast.success("API key copied to clipboard!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeKey.mutateAsync({ keyId });
      toast.success("API key revoked");
      refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke API key");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteKey.mutateAsync({ keyId });
      toast.success("API key deleted");
      refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete API key");
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header with Generate button */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">API Keys</Label>
          <p className="text-xs text-white/40 mt-0.5">
            For MetaTrader EA integration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowGenerateDialog(true)}
            className="ring ring-teal-500/25 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Key className="size-3.5" />
            Generate key
          </Button>
          <Link
            href="/dashboard/settings/ea-setup"
            className="flex items-center gap-2 px-4 py-2 h-[38px] bg-blue-900/20 ring ring-blue-500/30 rounded-md text-blue-300 text-xs hover:bg-blue-900/30 transition"
          >
            <span>Setup EA</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      <Separator />

      {/* Keys List */}
      <div className="px-6 sm:px-8 py-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {apiKeys?.length === 0 ? (
            <GoalSurface className="lg:col-span-2 2xl:col-span-3">
              <div className="py-12 text-center text-white/40">
                <Key className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No API keys yet</p>
                <p className="text-xs mt-1">
                  Generate one to connect your MetaTrader EA
                </p>
              </div>
            </GoalSurface>
          ) : (
            apiKeys?.map((key) => (
              <GoalSurface key={key.id} className="h-full">
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {key.name}
                      </span>
                      <code className="mt-1 block text-xs text-white/60 font-mono">
                        {key.keyPrefix}...
                      </code>
                    </div>

                    {key.isActive ? (
                      <Badge className="bg-teal-900/30 text-teal-400 ring-teal-500/30">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </div>

                  <GoalContentSeparator className="mb-3.5 mt-3.5" />

                  <div className="space-y-2 text-xs text-white/40">
                    <div className="flex items-center justify-between gap-3">
                      <span>Prefix</span>
                      <code className="font-mono text-white/65">
                        {key.keyPrefix}...
                      </code>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className="text-white/65">
                        {key.isActive ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Last used</span>
                      <span className="text-right text-white/65">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  <GoalContentSeparator className="mb-3.5 mt-3.5" />

                  <div className="flex flex-wrap items-center gap-2">
                    {key.isActive ? (
                      <Button
                        type="button"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={revokeKey.isPending}
                        className={getPropAssignActionButtonClassName({
                          tone: "neutral",
                          size: "sm",
                        })}
                      >
                        Revoke
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => handleDeleteKey(key.id)}
                      disabled={deleteKey.isPending}
                      className={getPropAssignActionButtonClassName({
                        tone: "danger",
                        size: "sm",
                      })}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </GoalSurface>
            ))
          )}
        </div>
      </div>

      {/* Generate API Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Key className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Generate API Key
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Create a new API key for your MetaTrader Expert Advisor
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-col gap-2">
                <Label className="text-white/80">Key Name</Label>
                <Input
                  placeholder="e.g., My FTMO Account EA"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                  className="bg-sidebar-accent ring-white/5 text-white"
                />
                <p className="text-xs text-white/40">
                  Choose a descriptive name to identify this key
                </p>
              </div>
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setShowGenerateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateKey}
                disabled={generateKey.isPending || !newApiKeyName.trim()}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                {generateKey.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-2xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Your API showKeyDialog has been generated
                </div>
                <p className="mt-1 text-xs leading-relaxed text-rose-400">
                  Copy this key now - you won't be able to see it again!
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-4 bg-sidebar-accent ring ring-white/10 rounded-md">
                <code className="flex-1 text-white font-mono text-sm break-all">
                  {generatedKey}
                </code>
                <Button
                  size="sm"
                  onClick={handleCopyKey}
                  className="ring ring-teal-600/50 bg-teal-600/25 hover:bg-teal-600/35 text-teal-300"
                >
                  {copiedKey ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>

              <div className="bg-yellow-900/20 ring ring-yellow-500/30 p-4 rounded-md">
                <p className="text-yellow-300 text-sm font-medium mb-2">
                  Important:
                </p>
                <ul className="text-yellow-200 text-xs space-y-1 list-disc list-inside">
                  <li>Save this key in a secure location</li>
                  <li>You'll need it to configure your MetaTrader EA</li>
                  <li>This key won't be shown again</li>
                  <li>If lost, generate a new key and update your EA</li>
                </ul>
              </div>

              <Link
                href="/dashboard/settings/ea-setup"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-900/20 ring ring-blue-500/30 rounded-md text-blue-300 text-sm hover:bg-blue-900/30 transition"
              >
                <Download className="size-3.5" />
                <span>Download &amp; setup expert advisor (EA)</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                onClick={() => {
                  setShowKeyDialog(false);
                  setGeneratedKey("");
                }}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none w-full"
              >
                I've saved my key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
