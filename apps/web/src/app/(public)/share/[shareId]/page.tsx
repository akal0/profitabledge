"use client";

import { use } from "react";
import Link from "next/link";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpc } from "@/utils/trpc";
import { PnlCardRenderer } from "@/components/pnl-card/pnl-card-renderer";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { toPng } from "html-to-image";
import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { ProfitabledgeVerificationCard, resolveAbsolutePublicUrl } from "@/components/verification/profitabledge-verification-card";

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const { shareId } = use(params);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: sharedCard, isLoading } = trpc.pnlCards.getSharedCard.useQuery({
    shareId,
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 3 });

      const link = document.createElement("a");
      link.download = `pnl-card-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Card downloaded!");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download card");
    }
  };

  if (isLoading) {
    return <RouteLoadingFallback route="sharedCard" className="min-h-screen bg-background dark:bg-sidebar" />;
  }

  if (!sharedCard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Card Not Found</h1>
          <p className="text-muted-foreground">
            This card may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const config = sharedCard.config as any;
  const cardData = sharedCard.cardData as any;
  const verification = sharedCard.verification as
    | { path: string; code: string; issuedAt: string }
    | undefined;
  const cardVerification = verification
    ? {
        url: resolveAbsolutePublicUrl(verification.path),
        code: verification.code,
      }
    : null;

  return (
    <div className="min-h-screen bg-sidebar px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <GoalSurface innerClassName="overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/82">
                  Profitabledge share
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Trade Performance Card
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/46">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{sharedCard.viewCount} views</span>
                  </div>
                  <span>
                    Shared {new Date(sharedCard.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                className="h-9 rounded-sm border-white/8 bg-white/5 text-white/78 hover:bg-white/10 hover:text-white"
              >
                <Link href="/">
                  Create your own
                </Link>
              </Button>
            </div>
          </div>
        </GoalSurface>

        <GoalSurface innerClassName="overflow-hidden">
          <div className="px-2 py-6 md:px-4">
            <div className="flex justify-center">
              <div className="origin-top scale-[0.72] sm:scale-[0.84] md:scale-100">
                <PnlCardRenderer
                  ref={cardRef}
                  data={cardData}
                  config={config}
                  verification={cardVerification}
                />
              </div>
            </div>
          </div>
        </GoalSurface>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px]">
          <GoalSurface innerClassName="overflow-hidden">
            <div className="p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                Share actions
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Export or reopen the live share
              </p>
              <p className="mt-2 text-sm leading-6 text-white/46">
                Downloads keep the Profitabledge verification stamp inside the
                image, so viewers can scan back to the signed verification
                record.
              </p>

              <GoalContentSeparator className="mb-4 mt-4" />

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDownload} size="lg" className="h-10 rounded-sm bg-teal-500 text-black hover:bg-teal-400">
                  <Download className="w-5 h-5 mr-2" />
                  Download Card
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-10 rounded-sm border-white/8 bg-white/5 text-white/78 hover:bg-white/10 hover:text-white"
                >
                  <Link href="/">
                    Create Your Own
                  </Link>
                </Button>
              </div>
            </div>
          </GoalSurface>

          {verification ? (
            <ProfitabledgeVerificationCard
              verification={verification}
              title="Signed card verification"
              description="Scan the QR code or open the verify page to confirm this share came from Profitabledge."
              compact
            />
          ) : null}
        </div>

        <div className="text-center text-sm text-white/38">
          <p>
            Powered by{" "}
            <Link href="/" className="font-semibold text-white/65 hover:text-teal-300">
              profitabledge
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
