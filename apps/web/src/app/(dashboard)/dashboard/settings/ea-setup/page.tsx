"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Download,
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function EASetupPage() {
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [customNgrokUrl, setCustomNgrokUrl] = useState("");
  const [downloadedEA, setDownloadedEA] = useState(false);

  const { data: apiKeys } = useQuery(trpc.apiKeys.list.queryOptions());
  const { data: accounts } = useQuery(trpc.accounts.list.queryOptions());

  const activeKey = apiKeys?.find((k) => k.isActive);
  const hasMT5Account = accounts?.some((acc) => acc.brokerType === "mt5");

  // Use custom ngrok URL if provided, otherwise fallback to env or localhost
  const apiUrl =
    customNgrokUrl ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";
  const webhookUrl = `${apiUrl}/trpc/webhook.priceUpdate`;
  const isLocalhost =
    apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

  // Load download state from localStorage on mount
  React.useEffect(() => {
    const downloaded = localStorage.getItem("ea-downloaded");
    if (downloaded === "true") {
      setDownloadedEA(true);
    }
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedApiUrl(true);
    toast.success("API URL copied!");
    setTimeout(() => setCopiedApiUrl(false), 2000);
  };

  const handleDownloadEA = () => {
    // Trigger download
    window.location.href = "/api/download-ea";
    toast.success("Downloading EA...");
    // Mark as downloaded
    setDownloadedEA(true);
    localStorage.setItem("ea-downloaded", "true");
  };

  const steps = [
    {
      title: "Generate API Key",
      description: "Create an API key in Settings",
      completed: !!activeKey,
    },
    {
      title: "Download EA",
      description: "Download profitabledge_data_bridge.mq5",
      completed: downloadedEA,
    },
    {
      title: "Install EA",
      description: "Copy EA to MetaTrader 5 Experts folder",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
    {
      title: "Configure EA",
      description: "Set API key and enable WebRequest",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
    {
      title: "Verify Connection",
      description: "Check that EA is sending data",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
  ];

  return (
    <SidebarProvider className="min-h-[100vh] h-full relative">
      <AppSidebar />
      <VerticalSeparator />

      <SidebarInset className="bg-white dark:bg-sidebar py-2 h-full flex flex-col gap-6">
        <div className="flex flex-col">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-2 bg-white dark:bg-sidebar rounded-t-[8px] px-8">
            <div className="flex items-center gap-3 w-full">
              <h1 className="text-lg font-semibold text-white">
                Expert Advisor Setup
              </h1>
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
                  <BreadcrumbLink
                    href="/dashboard/settings"
                    className="hover:text-secondary text-secondary dark:text-neutral-300 font-medium"
                  >
                    Settings
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-secondary dark:text-neutral-200">
                    EA Setup
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <Separator />
        </div>

        <div className="flex flex-col gap-6 px-8 pb-12 max-w-4xl">
          {/* Hero Section */}
          <Card className="p-6 bg-gradient-to-br from-teal-900/20 to-blue-900/20 border-teal-500/30">
            <h2 className="text-xl font-bold text-white mb-2">
              100% Accurate Drawdown Analysis
            </h2>
            <p className="text-white/80 text-sm mb-4">
              Install the profitabledge data bridge EA to send your broker's
              actual price data for perfect drawdown calculations.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-teal-400">100%</div>
                <div className="text-xs text-white/60">Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-400">$0</div>
                <div className="text-xs text-white/60">Cost</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-400">&lt;0.5%</div>
                <div className="text-xs text-white/60">CPU Usage</div>
              </div>
            </div>
          </Card>

          {/* Progress Steps */}
          <Card className="p-6 bg-sidebar border-white/5">
            <h3 className="text-base font-semibold text-white mb-4">
              Setup Progress
            </h3>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {step.completed ? (
                      <CheckCircle2 className="size-5 text-teal-400" />
                    ) : (
                      <Circle className="size-5 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      {step.title}
                    </div>
                    <div className="text-white/60 text-xs">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Step 1: API Key */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                1
              </span>
              <h3 className="text-base font-semibold text-white">
                Generate API Key
              </h3>
            </div>

            {activeKey ? (
              <div className="bg-teal-900/20 border border-teal-500/30 p-4 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-4 text-teal-400" />
                  <span className="text-teal-300 text-sm font-medium">
                    API Key Ready
                  </span>
                </div>
                <p className="text-white/60 text-xs mb-3">{activeKey.name}</p>
                <code className="text-xs text-white/80 font-mono bg-sidebar-accent px-2 py-1 rounded">
                  {activeKey.keyPrefix}...
                </code>
              </div>
            ) : (
              <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="size-4 text-yellow-400" />
                  <span className="text-yellow-300 text-sm font-medium">
                    No API Key Found
                  </span>
                </div>
                <p className="text-white/60 text-xs mb-3">
                  You need to generate an API key first.
                </p>
                <Link href="/dashboard/settings">
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8">
                    Go to Settings
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          {/* Step 2: Download EA */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                2
              </span>
              <h3 className="text-base font-semibold text-white">
                Download Expert Advisor
              </h3>
            </div>

            <p className="text-white/60 text-sm mb-4">
              Download the profitabledge data bridge EA for MetaTrader 5.
            </p>

            <Button
              onClick={handleDownloadEA}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Download className="size-4 mr-2" />
              Download profitabledge_data_bridge.mq5
            </Button>

            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-md">
              <p className="text-blue-300 text-xs">
                <strong>MT4 Users:</strong> MT4 support coming soon! For now,
                use MT5 or stick with Dukascopy data.
              </p>
            </div>
          </Card>

          {/* Ngrok Setup Warning/Instructions */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="size-5 text-yellow-400" />
              <h3 className="text-base font-semibold text-white">
                Setup Ngrok Tunnel (Required for MT5)
              </h3>
            </div>

            {isLocalhost && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-md mb-4">
                <p className="text-yellow-300 text-sm font-medium mb-2">
                  ⚠️ Localhost URL detected!
                </p>
                <p className="text-yellow-200 text-xs">
                  MetaTrader 5 cannot connect to localhost. You need to expose
                  your local server using ngrok.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <p className="text-white/80 text-sm mb-3">
                  <strong>Why ngrok?</strong>
                </p>
                <p className="text-white/60 text-xs mb-4">
                  MT5 Expert Advisors need a publicly accessible URL to send
                  data. Ngrok creates a secure tunnel from the internet to your
                  local server.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-900/30 text-blue-400 border-blue-500/30 shrink-0">
                    1
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1 text-sm">
                      Install ngrok
                    </p>
                    <div className="bg-sidebar-accent p-3 rounded-md font-mono text-xs text-white/80 mb-2">
                      brew install ngrok/ngrok/ngrok
                    </div>
                    <p className="text-white/60 text-xs">
                      Or download from{" "}
                      <a
                        href="https://ngrok.com/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300"
                      >
                        ngrok.com/download
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-900/30 text-blue-400 border-blue-500/30 shrink-0">
                    2
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1 text-sm">
                      Start ngrok tunnel
                    </p>
                    <div className="bg-sidebar-accent p-3 rounded-md font-mono text-xs text-white/80 mb-2">
                      ngrok http 3000
                    </div>
                    <p className="text-white/60 text-xs">
                      This will expose your local server on port 3000
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-900/30 text-blue-400 border-blue-500/30 shrink-0">
                    3
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1 text-sm">
                      Copy your ngrok URL
                    </p>
                    <p className="text-white/60 text-xs mb-2">
                      Look for the "Forwarding" line (e.g.,
                      https://abc123.ngrok.io)
                    </p>
                    <div className="space-y-2">
                      <label className="text-white/60 text-xs">
                        Paste your ngrok URL here:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://your-url.ngrok.io"
                          value={customNgrokUrl}
                          onChange={(e) => setCustomNgrokUrl(e.target.value)}
                          className="flex-1 bg-sidebar-accent border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                        />
                        {customNgrokUrl && !isLocalhost && (
                          <CheckCircle2 className="size-5 text-teal-400 mt-2" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-md mt-4">
                <p className="text-blue-300 text-xs">
                  <strong>Pro Tip:</strong> Keep the ngrok terminal window open
                  while using the EA. If you restart ngrok, you'll get a new URL
                  and need to update the EA settings.
                </p>
              </div>

              {!isLocalhost && customNgrokUrl && (
                <div className="bg-teal-900/20 border border-teal-500/30 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="size-4 text-teal-400" />
                    <span className="text-teal-300 text-sm font-medium">
                      URL Configured
                    </span>
                  </div>
                  <p className="text-white/60 text-xs mb-2">
                    Your webhook URL:
                  </p>
                  <code className="text-xs text-white/80 font-mono bg-sidebar-accent px-2 py-1 rounded break-all">
                    {webhookUrl}
                  </code>
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Installation Instructions */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                3
              </span>
              <h3 className="text-base font-semibold text-white">
                Install EA in MetaTrader 5
              </h3>
            </div>

            <div className="space-y-4 text-sm text-white/80">
              <div className="flex items-start gap-3">
                <Badge className="bg-teal-900/30 text-teal-400 border-teal-500/30 shrink-0">
                  A
                </Badge>
                <div>
                  <p className="font-medium text-white mb-1">
                    Open Data Folder
                  </p>
                  <p className="text-white/60 text-xs">
                    In MT5: File → Open Data Folder
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-teal-900/30 text-teal-400 border-teal-500/30 shrink-0">
                  B
                </Badge>
                <div>
                  <p className="font-medium text-white mb-1">
                    Navigate to Experts
                  </p>
                  <p className="text-white/60 text-xs">
                    Go to: MQL5 → Experts folder
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-teal-900/30 text-teal-400 border-teal-500/30 shrink-0">
                  C
                </Badge>
                <div>
                  <p className="font-medium text-white mb-1">Copy EA File</p>
                  <p className="text-white/60 text-xs">
                    Copy profitabledge_data_bridge.mq5 into this folder
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-teal-900/30 text-teal-400 border-teal-500/30 shrink-0">
                  D
                </Badge>
                <div>
                  <p className="font-medium text-white mb-1">
                    Refresh Navigator
                  </p>
                  <p className="text-white/60 text-xs">
                    Right-click Navigator → Refresh (or restart MT5)
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4: Configuration */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                4
              </span>
              <h3 className="text-base font-semibold text-white">
                Configure EA Settings
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-white/80 text-sm mb-3">
                  <strong>1.</strong> Enable WebRequest in MT5:
                </p>
                <ul className="list-disc list-inside text-white/60 text-xs space-y-1 ml-4">
                  <li>Tools → Options → Expert Advisors</li>
                  <li>✅ Allow automated trading</li>
                  <li>✅ Allow WebRequest for listed URL</li>
                  <li>
                    Add <strong>ONLY the base URL</strong> (without
                    /trpc/webhook...)
                  </li>
                </ul>

                <div className="bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-md mt-3 mb-3">
                  <p className="text-yellow-300 text-xs font-medium mb-2">
                    ⚠️ Important: Add base URL only!
                  </p>
                  <div className="space-y-1 text-xs">
                    <p className="text-white/60">✅ Correct:</p>
                    <code className="text-teal-400 font-mono">{apiUrl}</code>
                    <p className="text-white/60 mt-2">❌ Wrong:</p>
                    <code className="text-red-400 font-mono line-through">
                      {webhookUrl}
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-sidebar-accent px-3 py-2 rounded text-white/80 font-mono">
                    {apiUrl}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(apiUrl);
                      toast.success("Base URL copied!");
                    }}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {copiedApiUrl ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-white/60 text-xs mt-2">
                  Adding just the base URL allows all EA endpoints
                  (registration, price updates, etc.) to work.
                </p>
              </div>

              <Separator className="bg-white/5" />

              <div>
                <p className="text-white/80 text-sm mb-3">
                  <strong>2.</strong> Attach EA to any chart:
                </p>
                <ul className="list-disc list-inside text-white/60 text-xs space-y-1 ml-4">
                  <li>Drag EA from Navigator onto any chart</li>
                  <li>Configure these settings:</li>
                </ul>

                <div className="mt-3 bg-sidebar-accent p-3 rounded-md">
                  <table className="w-full text-xs">
                    <tbody className="space-y-1">
                      <tr>
                        <td className="text-white/60 py-1">API_KEY:</td>
                        <td className="text-white/80 font-mono">
                          {activeKey
                            ? `${activeKey.keyPrefix}...`
                            : "(your key)"}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-white/60 py-1">API_URL:</td>
                        <td className="text-white/80 font-mono text-xs break-all">
                          {webhookUrl}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-white/60 py-1">
                          UPDATE_INTERVAL_MS:
                        </td>
                        <td className="text-white/80 font-mono">5000</td>
                      </tr>
                      <tr>
                        <td className="text-white/60 py-1">DEBUG_MODE:</td>
                        <td className="text-white/80 font-mono">true</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 5: Verification */}
          <Card className="p-6 bg-sidebar border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                5
              </span>
              <h3 className="text-base font-semibold text-white">
                Verify Connection
              </h3>
            </div>

            {activeKey?.lastUsedAt ? (
              <div className="bg-teal-900/20 border border-teal-500/30 p-4 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-4 text-teal-400" />
                  <span className="text-teal-300 text-sm font-medium">
                    EA Connected!
                  </span>
                </div>
                <p className="text-white/60 text-xs">
                  Last ping: {new Date(activeKey.lastUsedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-white/60 text-sm mb-3">
                  Check the Experts tab in MT5 Terminal. You should see:
                </p>

                <div className="bg-sidebar-accent p-3 rounded-md font-mono text-xs text-white/80 space-y-1">
                  <div>======================================</div>
                  <div>profitabledge data bridge EA started</div>
                  <div>======================================</div>
                  <div>API URL: {webhookUrl}</div>
                  <div>Update Interval: 5 seconds</div>
                  <div>======================================</div>
                  <div className="text-teal-400 mt-2">
                    Data sent successfully: {"{"}success:true{"}"}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-md">
                  <p className="text-yellow-300 text-xs">
                    <strong>Not seeing success messages?</strong> Check:
                  </p>
                  <ul className="text-yellow-200 text-xs mt-2 space-y-1 list-disc list-inside ml-2">
                    <li>WebRequest is enabled for the correct URL</li>
                    <li>API key is correct</li>
                    <li>
                      You have open positions (if TRACK_ALL_SYMBOLS = false)
                    </li>
                    <li>Internet connection is working</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* Help Section */}
          <Card className="p-6 bg-sidebar border-white/5">
            <h3 className="text-base font-semibold text-white mb-4">
              Need Help?
            </h3>
            <div className="space-y-3 text-sm">
              <a
                href="https://github.com/profitabledge/ea-issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-teal-400 hover:text-teal-300"
              >
                <ExternalLink className="size-4" />
                <span>Report an Issue</span>
              </a>
              <a
                href="mailto:support@profitabledge.com"
                className="flex items-center gap-2 text-teal-400 hover:text-teal-300"
              >
                <ExternalLink className="size-4" />
                <span>Email Support</span>
              </a>
            </div>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
