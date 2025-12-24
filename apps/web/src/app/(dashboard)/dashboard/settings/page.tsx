"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc, trpcClient, queryClient } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { useState } from "react";
import { Copy, Check, Trash2, Key, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

const BROKER_LIST = [
  { value: "ftmo", label: "FTMO" },
  { value: "icmarkets", label: "IC Markets" },
  { value: "pepperstone", label: "Pepperstone" },
  { value: "oanda", label: "OANDA" },
  { value: "xm", label: "XM" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  const { selectedAccountId } = useAccountStore();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Get current account
  const { data: accounts } = useQuery(trpc.accounts.list.queryOptions());
  const currentAccount = accounts?.find((acc) => acc.id === selectedAccountId);

  // API Keys
  const { data: apiKeys, refetch: refetchKeys } = useQuery(
    trpc.apiKeys.list.queryOptions()
  );
  const generateKey = useMutation({
    mutationFn: (input: { name: string }) =>
      trpcClient.apiKeys.generate.mutate(input),
  });
  const revokeKey = useMutation({
    mutationFn: (input: { keyId: string }) =>
      trpcClient.apiKeys.revoke.mutate(input),
  });
  const deleteKey = useMutation({
    mutationFn: (input: { keyId: string }) =>
      trpcClient.apiKeys.delete.mutate(input),
  });

  // Account settings
  const updateBrokerSettings = useMutation({
    mutationFn: (input: any) =>
      trpcClient.accounts.updateBrokerSettings.mutate(input),
  });

  const [brokerSettings, setBrokerSettings] = useState({
    brokerType: (currentAccount?.brokerType as any) || "mt5",
    preferredDataSource:
      (currentAccount?.preferredDataSource as any) || "dukascopy",
    averageSpreadPips: currentAccount?.averageSpreadPips
      ? Number(currentAccount.averageSpreadPips)
      : undefined,
  });

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

  const handleSaveBrokerSettings = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      await updateBrokerSettings.mutateAsync({
        accountId: selectedAccountId,
        ...brokerSettings,
      });
      toast.success("Broker settings saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    }
  };

  return (
    <SidebarProvider className="min-h-[100vh] h-full relative">
      <AppSidebar />
      <VerticalSeparator />

      <SidebarInset className="bg-white dark:bg-sidebar py-2 h-full flex flex-col gap-6">
        <div className="flex flex-col">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-2 bg-white dark:bg-sidebar rounded-t-[8px] px-8">
            <div className="flex items-center gap-3 w-full">
              <h1 className="text-lg font-semibold text-white">Settings</h1>
            </div>
          </header>

          <Separator />

          <div className="px-8 py-4">
            <Breadcrumb>
              <BreadcrumbList className="text-xs text-secondary dark:text-neutral-400">
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink
                    href="/dashboard"
                    className="hover:text-secondary text-secondary dark:text-neutral-300 font-medium"
                  >
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-secondary dark:text-neutral-200">
                    Settings
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <Separator />
        </div>

        <div className="flex flex-col gap-6 px-8 pb-12">
          {/* Broker Settings Card */}
          <Card className="p-6 bg-sidebar border-white/5">
            <h2 className="text-base font-semibold text-white mb-4">
              Broker Settings
            </h2>
            <p className="text-sm text-white/60 mb-6">
              Configure your broker type and data source preferences for more
              accurate drawdown analysis.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-white/80 text-sm">Broker</Label>
                <Select value={currentAccount?.broker || ""} disabled>
                  <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                    <SelectValue placeholder="Select broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {BROKER_LIST.map((broker) => (
                      <SelectItem key={broker.value} value={broker.value}>
                        {broker.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/40">
                  Set during account creation
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-white/80 text-sm">Platform Type</Label>
                <Select
                  value={brokerSettings.brokerType}
                  onValueChange={(value: any) =>
                    setBrokerSettings({ ...brokerSettings, brokerType: value })
                  }
                >
                  <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mt4">MetaTrader 4</SelectItem>
                    <SelectItem value="mt5">MetaTrader 5</SelectItem>
                    <SelectItem value="ctrader">cTrader</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-white/80 text-sm">Data Source</Label>
                <Select
                  value={brokerSettings.preferredDataSource}
                  onValueChange={(value: any) =>
                    setBrokerSettings({
                      ...brokerSettings,
                      preferredDataSource: value,
                    })
                  }
                >
                  <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dukascopy">
                      Dukascopy (Recommended)
                    </SelectItem>
                    <SelectItem value="alphavantage">Alpha Vantage</SelectItem>
                    <SelectItem value="truefx">TrueFX</SelectItem>
                    <SelectItem value="broker">Broker (EA Required)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-white/80 text-sm">
                  Average Spread (pips)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 0.8"
                  value={brokerSettings.averageSpreadPips || ""}
                  onChange={(e) =>
                    setBrokerSettings({
                      ...brokerSettings,
                      averageSpreadPips: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="bg-sidebar-accent border-white/5 text-white"
                />
                <p className="text-xs text-white/40">
                  Optional: Improves accuracy for your specific broker
                </p>
              </div>
            </div>

            <Button
              onClick={handleSaveBrokerSettings}
              disabled={updateBrokerSettings.isPending || !selectedAccountId}
              className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {updateBrokerSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </Card>

          {/* API Keys Card */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">API Keys</h2>
                <p className="text-sm text-white/60 mt-1">
                  For MetaTrader Expert Advisor integration
                </p>
              </div>
              <Button
                onClick={() => setShowGenerateDialog(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Key className="size-4 mr-2" />
                Generate Key
              </Button>
            </div>

            {/* EA Setup Link */}
            <Link
              href="/dashboard/settings/ea-setup"
              className="flex items-center gap-2 px-4 py-3 bg-blue-900/20 border border-blue-500/30 rounded-md text-blue-300 text-sm mb-6 hover:bg-blue-900/30 transition"
            >
              <Download className="size-4" />
              <span>Download & Setup Expert Advisor</span>
              <ExternalLink className="size-3 ml-auto" />
            </Link>

            <div className="space-y-3">
              {apiKeys?.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <Key className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No API keys yet</p>
                  <p className="text-xs mt-1">
                    Generate one to connect your MetaTrader EA
                  </p>
                </div>
              ) : (
                apiKeys?.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 bg-sidebar-accent border border-white/5 rounded-md"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-medium text-sm">
                        {key.name}
                      </span>
                      <code className="text-xs text-white/60 font-mono">
                        {key.keyPrefix}...
                      </code>
                      {key.lastUsedAt && (
                        <span className="text-xs text-white/40">
                          Last used: {new Date(key.lastUsedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {key.isActive ? (
                        <Badge className="bg-teal-900/30 text-teal-400 border-teal-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Revoked</Badge>
                      )}

                      {key.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={revokeKey.isPending}
                          className="text-white/60 hover:text-white"
                        >
                          Revoke
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteKey(key.id)}
                        disabled={deleteKey.isPending}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </SidebarInset>

      {/* Generate API Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="bg-sidebar border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Generate API Key</DialogTitle>
            <DialogDescription className="text-white/60">
              Create a new API key for your MetaTrader Expert Advisor
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label className="text-white/80">Key Name</Label>
              <Input
                placeholder="e.g., My FTMO Account EA"
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                className="bg-sidebar-accent border-white/5 text-white"
              />
              <p className="text-xs text-white/40">
                Choose a descriptive name to identify this key
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowGenerateDialog(false)}
              className="text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateKey}
              disabled={generateKey.isPending || !newApiKeyName.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {generateKey.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-sidebar border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Your API Key Has Been Generated
            </DialogTitle>
            <DialogDescription className="text-rose-400">
              ⚠️ Copy this key now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2 p-4 bg-sidebar-accent border border-white/10 rounded-md">
              <code className="flex-1 text-white font-mono text-sm break-all">
                {generatedKey}
              </code>
              <Button
                size="sm"
                onClick={handleCopyKey}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {copiedKey ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-md">
              <p className="text-yellow-300 text-sm font-medium mb-2">
                Important:
              </p>
              <ul className="text-yellow-200 text-xs space-y-1 list-disc list-inside">
                <li>Save this key in a secure location</li>
                <li>You'll need it to configure your MetaTrader EA</li>
                <li>This key won't be shown again</li>
                <li>
                  If lost, you'll need to generate a new key and update your EA
                </li>
              </ul>
            </div>

            <Link
              href="/dashboard/settings/ea-setup"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-900/20 border border-blue-500/30 rounded-md text-blue-300 text-sm hover:bg-blue-900/30 transition"
            >
              <Download className="size-4" />
              <span>Next: Download & Setup Expert Advisor</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialog(false);
                setGeneratedKey("");
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white w-full"
            >
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
