"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/utils/trpc";
import {
  PnlCardRenderer,
  type PnlCardData,
  type PnlCardConfig,
} from "./pnl-card-renderer";
import { toPng, toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Copy, Download, Share2, Upload, Sparkles } from "lucide-react";

interface ShareCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeData: PnlCardData;
}

const DEFAULT_CONFIG: PnlCardConfig = {
  backgroundType: "gradient",
  backgroundValue: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  layout: {
    font: "Inter",
    fontSize: {
      title: 32,
      stat: 24,
      label: 14,
    },
    colors: {
      primary: "#ffffff",
      secondary: "#9CA3AF",
      accent: "#10B981",
      negative: "#EF4444",
    },
    elements: ["profit", "rr", "pips", "duration", "volume"],
    logoPosition: "bottom-right",
  },
  showBranding: true,
};

const GRADIENT_PRESETS = [
  {
    name: "Purple Dream",
    value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    name: "Ocean Blue",
    value: "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
  },
  {
    name: "Green Energy",
    value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  },
  {
    name: "Sunset",
    value: "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
  },
  {
    name: "Dark Mode",
    value: "linear-gradient(135deg, #1e1e1e 0%, #434343 100%)",
  },
  {
    name: "Gold Luxury",
    value: "linear-gradient(135deg, #f09819 0%, #edde5d 100%)",
  },
];

export function ShareCardDialog({
  open,
  onOpenChange,
  tradeData,
}: ShareCardDialogProps) {
  const [config, setConfig] = useState<PnlCardConfig>(DEFAULT_CONFIG);
  const [customText, setCustomText] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState(100);
  const [imageBlur, setImageBlur] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: templates } = trpc.pnlCards.listTemplates.useQuery();
  const createSharedCard = trpc.pnlCards.createSharedCard.useMutation();

  const handleTemplateSelect = (template: any) => {
    setConfig({
      backgroundType: template.backgroundType,
      backgroundValue: template.backgroundValue,
      backgroundImageUrl: template.backgroundImageUrl,
      layout: template.layout,
      showBranding: true,
    });
  };

  const handleGradientSelect = (gradient: { name: string; value: string }) => {
    setConfig({
      ...config,
      backgroundType: "gradient",
      backgroundValue: gradient.value,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setUploadedImage(result);
        setConfig({
          ...config,
          backgroundType: "image",
          backgroundImageUrl: result,
          imageOpacity: imageOpacity,
          imageBlur: imageBlur,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateImageSettings = () => {
    if (uploadedImage) {
      setConfig({
        ...config,
        imageOpacity: imageOpacity,
        imageBlur: imageBlur,
      });
    }
  };

  const handleDownload = async (format: "png" | "jpg") => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const dataUrl =
        format === "png"
          ? await toPng(cardRef.current, { quality: 1, pixelRatio: 3 })
          : await toJpeg(cardRef.current, { quality: 0.95, pixelRatio: 3 });

      const link = document.createElement("a");
      link.download = `pnl-card-${tradeData.symbol}-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();

      toast.success(`Card downloaded as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const result = await createSharedCard.mutateAsync({
        tradeId: tradeData.tradeId,
        config: {
          ...config,
          customText,
        },
        isPublic: true,
      });

      const shareUrl = `${window.location.origin}${result.shareUrl}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } catch (error) {
      console.error("Error creating share link:", error);
      toast.error("Failed to create share link");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share PnL Card
          </DialogTitle>
        </DialogHeader>

        <div
          className="flex flex-col gap-6 flex-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Top: Preview - Full height with 3:4 aspect ratio */}
          <div className="flex-1 flex items-center justify-center bg-black/20 rounded-lg overflow-hidden">
            <div className="h-full flex items-center justify-center p-4">
              <div
                className="h-full flex items-center justify-center"
                style={{ aspectRatio: "3/4" }}
              >
                <div className="scale-[0.55] origin-center">
                  <PnlCardRenderer
                    ref={cardRef}
                    data={tradeData}
                    config={{ ...config, customText }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Customization */}
          <div className="space-y-4 overflow-y-auto">
            <Tabs defaultValue="templates" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="gradients">Gradients</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>

              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {templates?.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-4 border rounded-lg hover:border-primary transition-colors text-left"
                    >
                      <div
                        className="w-full h-24 rounded mb-2"
                        style={{
                          background:
                            template.backgroundType === "gradient"
                              ? template.backgroundValue
                              : template.backgroundImageUrl
                              ? `url(${template.backgroundImageUrl})`
                              : template.backgroundValue,
                          backgroundSize: "cover",
                        }}
                      />
                      <p className="font-medium text-sm">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="gradients" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {GRADIENT_PRESETS.map((gradient) => (
                    <button
                      key={gradient.name}
                      onClick={() => handleGradientSelect(gradient)}
                      className="group"
                    >
                      <div
                        className="w-full h-24 rounded-lg mb-2 group-hover:scale-105 transition-transform"
                        style={{ background: gradient.value }}
                      />
                      <p className="text-sm font-medium">{gradient.name}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="custom-image">
                      Upload Background Image
                    </Label>
                    <div className="mt-2">
                      <label
                        htmlFor="custom-image"
                        className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        <span>Click to upload image</span>
                      </label>
                      <input
                        id="custom-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {uploadedImage && (
                    <>
                      <div>
                        <Label htmlFor="image-opacity">
                          Background Opacity: {imageOpacity}%
                        </Label>
                        <input
                          id="image-opacity"
                          type="range"
                          min="0"
                          max="100"
                          value={imageOpacity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            setImageOpacity(value);
                            setConfig({
                              ...config,
                              imageOpacity: value,
                            });
                          }}
                          className="mt-2 w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="image-blur">
                          Background Blur: {imageBlur}px
                        </Label>
                        <input
                          id="image-blur"
                          type="range"
                          min="0"
                          max="20"
                          value={imageBlur}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            setImageBlur(value);
                            setConfig({
                              ...config,
                              imageBlur: value,
                            });
                          }}
                          className="mt-2 w-full"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="custom-text">Custom Text (Optional)</Label>
                    <Input
                      id="custom-text"
                      placeholder="Add a personal message..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Primary Color</Label>
                    <Input
                      type="color"
                      value={config.layout.colors.primary}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          layout: {
                            ...config.layout,
                            colors: {
                              ...config.layout.colors,
                              primary: e.target.value,
                            },
                          },
                        })
                      }
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => handleDownload("png")}
                disabled={isGenerating}
              >
                <Download className="w-4 h-4 mr-2" />
                PNG
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("jpg")}
                disabled={isGenerating}
              >
                <Download className="w-4 h-4 mr-2" />
                JPG
              </Button>
              <Button onClick={handleShare} disabled={isGenerating}>
                <Copy className="w-4 h-4 mr-2" />
                Share Link
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
