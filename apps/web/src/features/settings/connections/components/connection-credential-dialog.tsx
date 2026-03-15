"use client";

import { Loader2, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ConnectionProviderDefinition } from "@/features/settings/connections/lib/connection-types";

export function ConnectionCredentialDialog({
  open,
  onOpenChange,
  provider,
  displayName,
  credentialForm,
  isConnecting,
  onDisplayNameChange,
  onCredentialChange,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ConnectionProviderDefinition | undefined;
  displayName: string;
  credentialForm: Record<string, string>;
  isConnecting: boolean;
  onDisplayNameChange: (value: string) => void;
  onCredentialChange: (field: string, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Link2 className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Connect to {provider?.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Enter your credentials to connect. They will be encrypted and stored securely.</p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>

          <Separator />

          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Connection
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Connection name</Label>
              <Input
                placeholder={`My ${provider?.name ?? ""} Account`}
                value={displayName}
                onChange={(event) => onDisplayNameChange(event.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Credentials
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-5 py-4">
            {provider?.fields.map((field) => (
              <div key={field} className="space-y-2">
                <Label className="text-xs text-white/50">
                  {field === "serverUrl"
                    ? "Server URL"
                    : field.charAt(0).toUpperCase() + field.slice(1)}
                </Label>
                <Input
                  type={field === "password" ? "password" : "text"}
                  placeholder={
                    field === "serverUrl"
                      ? "https://broker.match-trader.com"
                      : field === "email"
                        ? "your@email.com"
                        : ""
                  }
                  value={credentialForm[field] ?? ""}
                  onChange={(event) => onCredentialChange(field, event.target.value)}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <Button
              onClick={onCancel}
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isConnecting || !displayName.trim()}
              className="h-[38px] w-max cursor-pointer gap-2 rounded-sm border border-teal-400/20 bg-teal-400/12 px-5 py-2 text-xs text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-250 hover:bg-teal-400/20 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
