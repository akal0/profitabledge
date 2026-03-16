"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockKeyholeIcon } from "lucide-react";
import { trpcClient } from "@/utils/trpc";

export default function BetaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/login";
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await trpcClient.billing.validatePrivateBetaCode.query({
        code: code.trim(),
      });

      if (result.valid) {
        toast.success(
          "label" in result && result.label
            ? `${result.label} access unlocked`
            : "Private beta access unlocked"
        );
        document.cookie = `beta_access=verified; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        router.push(redirectTo);
      } else {
        const message =
          "message" in result ? result.message : "Invalid private beta code";
        setErrorMessage(message);
        toast.error(message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify beta code";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen relative bg-sidebar">
      <div
        className={cn(
          "z-99 opacity-25 absolute size-106 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95,0.05,0.795,0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      />
      <div
        className={cn(
          "z-98 opacity-25 absolute size-116 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95,0.05,0.795,0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      />
      <div
        className={cn(
          "z-97 opacity-25 absolute size-126 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:35s] before:[animation-timing-function:cubic-bezier(0.95,0.05,0.795,0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      />
      <div
        className={cn(
          "z-96 opacity-25 absolute size-136 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-28 before:-left-28 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95,0.05,0.795,0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-3px)] after:h-[calc(100%-3px)] after:rounded-3xl after:bg-sidebar"
        )}
      />
      <div
        className={cn(
          "z-95 opacity-25 absolute size-146 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-32 before:-left-32 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95,0.05,0.795,0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      />

      <div className="flex flex-col items-center justify-center gap-8 h-full w-full relative z-100">
        <div className="w-full max-w-md bg-sidebar rounded-3xl shadow-sidebar-button">
          <div className="flex flex-col items-center justify-center gap-1 py-6">
            <LockKeyholeIcon className="size-5 text-muted-foreground mb-1" />
            <h1 className="text-xl font-bold">Private Beta</h1>
            <p className="text-xs text-muted-foreground text-center px-8">
              profitabledge is currently in private beta. Enter your access code
              to continue.
            </p>
          </div>

          <Separator />

          <form onSubmit={handleSubmit} className="w-full space-y-6 py-6 pb-0">
            <div className="p-10 py-0 space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-medium">Beta access code</label>
                <Input
                  type="text"
                  placeholder="Enter your access code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setErrorMessage(null);
                  }}
                  autoFocus
                />
                {errorMessage && (
                  <p className="text-xs text-red-500">{errorMessage}</p>
                )}
              </div>
            </div>

            <div className="px-10">
              <Button
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex items-center justify-center w-full"
                type="submit"
                disabled={loading || !code.trim()}
              >
                {loading ? "Verifying..." : "Continue"}
              </Button>
            </div>
          </form>

          <Separator className="mt-6" />

          <p className="text-xs text-center text-secondary py-6 font-medium">
            Don't have a code?{" "}
            <a
              href="https://profitabledge.com"
              className="text-white font-medium"
            >
              Join the waitlist
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
