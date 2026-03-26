"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { trpcOptions } from "@/utils/trpc";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { normalizeOriginUrl } from "@profitabledge/platform";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ReportBugDialog } from "@/features/navigation/components/report-bug-dialog";

export default function EASetupPage() {
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [customNgrokUrl, setCustomNgrokUrl] = useState("");
  const [downloadedEA, setDownloadedEA] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const pathname = usePathname();

  const { data: apiKeys } = useQuery(trpcOptions.apiKeys.list.queryOptions());
  const { data: accounts } = useQuery(trpcOptions.accounts.list.queryOptions());

  const activeKey = apiKeys?.find((k) => k.isActive);
  const hasMT5Account = accounts?.some((acc) => acc.brokerType === "mt5");

  const apiUrl =
    customNgrokUrl ||
    normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
    "";
  const webhookUrl = apiUrl ? `${apiUrl}/trpc/webhook.priceUpdate` : "";
  const isLocalhost =
    apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

  React.useEffect(() => {
    const downloaded = localStorage.getItem("ea-downloaded");
    if (downloaded === "true") {
      setDownloadedEA(true);
    }
  }, []);

  const handleCopyUrl = (text: string, type: "api" | "base") => {
    navigator.clipboard.writeText(text);
    if (type === "api") {
      setCopiedApiUrl(true);
      setTimeout(() => setCopiedApiUrl(false), 2000);
    } else {
      setCopiedBaseUrl(true);
      setTimeout(() => setCopiedBaseUrl(false), 2000);
    }
    toast.success("Copied to clipboard!");
  };

  const handleDownloadEA = () => {
    window.location.href = "/api/download-ea";
    toast.success("Downloading EA...");
    setDownloadedEA(true);
    localStorage.setItem("ea-downloaded", "true");
  };

  const steps = [
    { title: "Generate API key", completed: !!activeKey },
    { title: "Download EA", completed: downloadedEA },
    {
      title: "Install EA in MT5",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
    {
      title: "Configure EA settings",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
    {
      title: "Verify connection",
      completed: hasMT5Account && !!activeKey?.lastUsedAt,
    },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Overview heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          EA data bridge setup
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Install the profitabledge data bridge EA for 100% accurate drawdown
          analysis.
        </p>
      </div>

      <Separator />

      {/* Setup Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Progress</Label>
          <p className="text-xs text-white/40 mt-0.5">
            {steps.filter((s) => s.completed).length}/{steps.length} steps
            complete.
          </p>
        </div>
        <div className="space-y-2.5">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2.5">
              {step.completed ? (
                <CheckCircle2 className="size-4 text-teal-400 shrink-0" />
              ) : (
                <Circle className="size-4 text-white/20 shrink-0" />
              )}
              <span
                className={
                  step.completed
                    ? "text-xs text-white/70"
                    : "text-xs text-white/40"
                }
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Step 1: API Key */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Step 1 — Generate API key
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Create an API key for your MetaTrader EA.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">API key</Label>
          <p className="text-xs text-white/40 mt-0.5">Required for EA auth.</p>
        </div>
        {activeKey ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-teal-400" />
              <span className="text-teal-300 text-sm font-medium">Ready</span>
            </div>
            <p className="text-xs text-white/40">{activeKey.name}</p>
            <code className="text-xs text-white/60 font-mono bg-sidebar-accent px-2 py-1 rounded">
              {activeKey.keyPrefix}...
            </code>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-yellow-400" />
              <span className="text-yellow-300 text-sm font-medium">
                No API key
              </span>
            </div>
            <p className="text-xs text-white/40">
              Generate one in API keys settings.
            </p>
            <Link href="/dashboard/settings/api">
              <Button className="ring ring-white/5 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[32px] w-max text-xs text-teal-300 cursor-pointer gap-2 transition-all active:scale-95 duration-250">
                Go to API keys
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Separator />

      {/* Step 2: Download EA */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Step 2 — Download expert advisor
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Download the profitabledge data bridge EA for MetaTrader 5.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">EA file</Label>
          <p className="text-xs text-white/40 mt-0.5">For MetaTrader 5.</p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={handleDownloadEA}
            className="ring ring-teal-600/50 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer gap-2 transition-all active:scale-95 duration-250"
          >
            <Download className="size-3.5" />
            Download profitabledge_data_bridge.mq5
          </Button>
          <p className="text-xs text-white/30">
            MT4 support coming soon. For now, use MT5 or stick with Dukascopy
            data.
          </p>
        </div>
      </div>

      <Separator />

      {/* Step 3: Ngrok (if localhost) */}
      {isLocalhost && (
        <>
          <div className="px-6 sm:px-8 py-5">
            <h2 className="text-sm font-semibold text-white">
              Set up ngrok tunnel
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Required — MT5 cannot connect to localhost.
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Install ngrok
              </Label>
              <p className="text-xs text-white/40 mt-0.5">Tunneling tool.</p>
            </div>
            <div className="space-y-2">
              <code className="text-xs text-white/60 font-mono bg-sidebar-accent px-3 py-2 rounded block">
                brew install ngrok/ngrok/ngrok
              </code>
              <p className="text-xs text-white/30">
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

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Start tunnel
              </Label>
              <p className="text-xs text-white/40 mt-0.5">Expose port 3000.</p>
            </div>
            <code className="text-xs text-white/60 font-mono bg-sidebar-accent px-3 py-2 rounded block">
              ngrok http 3000
            </code>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Ngrok URL
              </Label>
              <p className="text-xs text-white/40 mt-0.5">
                Paste your forwarding URL.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="https://your-url.ngrok.io"
                  value={customNgrokUrl}
                  onChange={(e) => setCustomNgrokUrl(e.target.value)}
                  className="bg-sidebar-accent ring-white/5 text-white text-sm"
                />
                {customNgrokUrl && !apiUrl.includes("localhost") && (
                  <CheckCircle2 className="size-5 text-teal-400 mt-2 shrink-0" />
                )}
              </div>
              <p className="text-xs text-white/30">
                Keep the ngrok terminal open while using the EA.
              </p>
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Step 3/4: Install EA */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Step 3 — Install EA in MetaTrader 5
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Copy the EA file into your MT5 Experts folder.
        </p>
      </div>

      <Separator />

      {[
        {
          step: "A",
          title: "Open data folder",
          desc: "In MT5: File → Open Data Folder",
        },
        {
          step: "B",
          title: "Navigate to experts",
          desc: "Go to: MQL5 → Experts folder",
        },
        {
          step: "C",
          title: "Copy EA file",
          desc: "Copy profitabledge_data_bridge.mq5 into this folder",
        },
        {
          step: "D",
          title: "Refresh navigator",
          desc: "Right-click Navigator → Refresh (or restart MT5)",
        },
      ].map((item, idx) => (
        <div key={item.step}>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-teal-900/30 text-teal-400 ring-teal-500/30 shrink-0 size-6 flex items-center justify-center p-0 text-xs">
                {item.step}
              </Badge>
              <Label className="text-sm text-white/80 font-medium">
                {item.title}
              </Label>
            </div>
            <p className="text-xs text-white/50">{item.desc}</p>
          </div>
          {idx < 3 && <Separator />}
        </div>
      ))}

      <Separator />

      {/* Step 4: Configure */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Step 4 — Configure EA settings
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Enable web request and set your API credentials.
        </p>
      </div>

      <Separator />

      {/* WebRequest setup */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Enable web request
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Required for EA communication.
          </p>
        </div>
        <div className="space-y-3">
          <ul className="list-disc list-inside text-xs text-white/50 space-y-1">
            <li>Tools → Options → Expert Advisors</li>
            <li>Allow automated trading</li>
            <li>Allow WebRequest for listed URL</li>
            <li>
              Add <strong className="text-white/70">only the base URL</strong>{" "}
              (without /trpc/webhook...)
            </li>
          </ul>

          <div className="flex gap-3 p-3 bg-yellow-500/10 ring ring-yellow-500/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-yellow-300 font-medium mb-1">
                Add base URL only!
              </p>
              <p className="text-white/40">
                Correct:{" "}
                <code className="text-teal-400 font-mono">{apiUrl}</code>
              </p>
              <p className="text-white/40 mt-0.5">
                Wrong:{" "}
                <code className="text-red-400/60 font-mono line-through">
                  {webhookUrl}
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-sidebar-accent ring ring-white/5 px-3 py-2 rounded text-white/70 font-mono">
              {apiUrl}
            </code>
            <Button
              size="sm"
              onClick={() => handleCopyUrl(apiUrl, "base")}
              className="ring ring-teal-600/50 bg-teal-600/25 hover:bg-teal-600/35 text-teal-300 h-8 w-8 p-0"
            >
              {copiedBaseUrl ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* EA Input Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            EA input values
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Set these when attaching EA to chart.
          </p>
        </div>
        <div className="bg-sidebar-accent ring ring-white/5 rounded-md p-3">
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="text-white/40 py-1.5 pr-4">API_KEY:</td>
                <td className="text-white/70 font-mono">
                  {activeKey ? `${activeKey.keyPrefix}...` : "(your key)"}
                </td>
              </tr>
              <tr>
                <td className="text-white/40 py-1.5 pr-4">API_URL:</td>
                <td className="text-white/70 font-mono text-xs break-all">
                  {webhookUrl}
                </td>
              </tr>
              <tr>
                <td className="text-white/40 py-1.5 pr-4">
                  UPDATE_INTERVAL_MS:
                </td>
                <td className="text-white/70 font-mono">5000</td>
              </tr>
              <tr>
                <td className="text-white/40 py-1.5 pr-4">DEBUG_MODE:</td>
                <td className="text-white/70 font-mono">true</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Step 5: Verify */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Step 5 — Verify connection
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Check the Experts tab in MT5 terminal.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Connection status
          </Label>
          <p className="text-xs text-white/40 mt-0.5">EA ping verification.</p>
        </div>
        {activeKey?.lastUsedAt ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-teal-400" />
              <span className="text-teal-300 text-sm font-medium">
                EA connected
              </span>
            </div>
            <p className="text-xs text-white/40">
              Last ping: {new Date(activeKey.lastUsedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-yellow-400" />
              <span className="text-yellow-300 text-sm font-medium">
                Waiting for EA
              </span>
            </div>
            <div className="bg-sidebar-accent ring ring-white/5 p-3 rounded-md font-mono text-xs text-white/60 space-y-0.5">
              <div>======================================</div>
              <div>profitabledge data bridge EA started</div>
              <div>======================================</div>
              <div>API URL: {webhookUrl}</div>
              <div>Update Interval: 5 seconds</div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Troubleshooting */}
      {!activeKey?.lastUsedAt && (
        <div className="px-6 sm:px-8 py-5">
          <div className="flex gap-3 p-4 bg-yellow-500/10 ring ring-yellow-500/20 rounded-md">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-300 mb-1">
                Not seeing success messages?
              </p>
              <ul className="text-xs text-white/50 space-y-1 list-disc list-inside">
                <li>WebRequest is enabled for the correct URL</li>
                <li>API key is correct</li>
                <li>You have open positions (if TRACK_ALL_SYMBOLS = false)</li>
                <li>Internet connection is working</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Need help?
          </Label>
          <p className="text-xs text-white/40 mt-0.5">Support resources.</p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setReportBugOpen(true)}
            className="flex cursor-pointer items-center gap-2 text-xs text-teal-400 hover:text-teal-300"
          >
            <ExternalLink className="size-3.5" />
            Report an issue
          </button>
          <a
            href="mailto:support@profitabledge.com"
            className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300"
          >
            <ExternalLink className="size-3.5" />
            Email support
          </a>
        </div>
      </div>

      <ReportBugDialog
        open={reportBugOpen}
        onOpenChange={setReportBugOpen}
        pagePath={pathname || "/dashboard/settings/ea-setup"}
      />
    </div>
  );
}
