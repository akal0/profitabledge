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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Trade Performance Card</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>{sharedCard.viewCount} views</span>
            </div>
            <div>
              <span>
                Shared {new Date(sharedCard.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card Preview */}
        <div className="flex justify-center">
          <div className="scale-75 sm:scale-90 md:scale-100">
            <PnlCardRenderer ref={cardRef} data={cardData} config={config} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button onClick={handleDownload} size="lg">
            <Download className="w-5 h-5 mr-2" />
            Download Card
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">
              Create Your Own
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Powered by{" "}
            <Link href="/" className="font-semibold hover:underline">
              profitabledge
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
