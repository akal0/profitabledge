"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpcOptions, queryClient } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Link as LinkIcon,
} from "lucide-react";
import { useUploadThing } from "@/utils/uploadthing";
import {
  CoverImageCropDialog,
  type CoverFrameDimensions,
} from "@/components/cover-image-crop-dialog";
import { DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE } from "@/lib/default-profile-banner";

function isGifFile(file: File) {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

function isGifUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  return /^data:image\/gif/i.test(value) || /\.gif(?:$|[?#])/i.test(value);
}

function revokeObjectUrl(value?: string | null) {
  if (value?.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function EditProfilePage() {
  const { data: user, isLoading } = useQuery(
    trpcOptions.users.me.queryOptions()
  );
  const { data: billingState } = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );

  const updateProfile = useMutation(
    trpcOptions.users.updateProfile.mutationOptions()
  );
  const clearImage = useMutation(
    trpcOptions.users.clearImage.mutationOptions()
  );
  const { startUpload: startAvatarUpload, isUploading: isAvatarUploading } =
    useUploadThing((r) => r.imageUploader);
  const { startUpload: startBannerUpload, isUploading: isBannerUploading } =
    useUploadThing((r) => r.imageUploader);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    displayName: "",
    bio: "",
    location: "",
    website: "",
    twitter: "",
    discord: "",
    image: "",
  });

  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerPosition, setBannerPosition] = useState("50% 50%");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const formInitialized = useRef(false);
  const avatarPreviewUrlRef = useRef<string>("");

  // Use refs for pending banner data to avoid stale closures entirely
  const pendingBannerFileRef = useRef<File | null>(null);
  const previousBannerUrlRef = useRef<string>("");

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingBannerSrc, setPendingBannerSrc] = useState("");
  const [bannerDimensions, setBannerDimensions] =
    useState<CoverFrameDimensions | null>(null);

  useEffect(() => {
    if (!user || formInitialized.current) return;
    formInitialized.current = true;
    setForm({
      fullName: user.name || "",
      username: user.username || "",
      displayName: (user as any).displayName || "",
      bio: (user as any).bio || "",
      location: (user as any).location || "",
      website: (user as any).website || "",
      twitter: user.twitter || "",
      discord: user.discord || "",
      image: user.image || "",
    });
    setBannerUrl((user as any).profileBannerUrl || "");
    setBannerPosition((user as any).profileBannerPosition || "50% 50%");
    setAvatarFile(null);
  }, [user]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(avatarPreviewUrlRef.current);
    };
  }, []);

  const activePlanKey = billingState?.billing?.activePlanKey;
  const canUseAnimatedProfileMedia = activePlanKey === "institutional";
  const bannerIsGif = isGifUrl(bannerUrl);

  const ensureAnimatedMediaAllowed = () => {
    if (!activePlanKey) {
      toast.error("Still loading your plan details. Try again in a moment.");
      return false;
    }

    if (activePlanKey !== "institutional") {
      toast.error("Animated GIF avatars and banners are available on Elite.");
      return false;
    }

    return true;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isGifFile(file) && !ensureAnimatedMediaAllowed()) {
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }

    revokeObjectUrl(avatarPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    avatarPreviewUrlRef.current = previewUrl;
    setAvatarFile(file);
    setForm((prev) => ({ ...prev, image: previewUrl }));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isGifFile(file) && !ensureAnimatedMediaAllowed()) {
      if (bannerInputRef.current) bannerInputRef.current.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    if (bannerInputRef.current) bannerInputRef.current.value = "";

    // Store previous URL for cancel reverting
    previousBannerUrlRef.current = bannerUrl;
    pendingBannerFileRef.current = file;

    // Set preview immediately — synchronous, no async
    const blobUrl = URL.createObjectURL(file);
    setBannerUrl(blobUrl);

    if (isGifFile(file)) {
      setBannerPosition("50% 50%");
      void (async () => {
        try {
          const res = await startBannerUpload([file]);
          const uploadedUrl = res?.[0]?.ufsUrl ?? res?.[0]?.url;
          if (uploadedUrl) {
            revokeObjectUrl(blobUrl);
            setBannerUrl(uploadedUrl);
            pendingBannerFileRef.current = null;
          }
        } catch {
          toast.error("Failed to upload cover GIF");
        }
      })();
      return;
    }

    // Open crop dialog so user can set position
    openCropDialog(blobUrl);
  };

  const openCropDialog = (src: string) => {
    if (bannerContainerRef.current) {
      const { width, height } =
        bannerContainerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setBannerDimensions({ width, height });
      }
    }
    setPendingBannerSrc(src);
    setCropDialogOpen(true);
  };

  // "Edit cover" — reposition existing banner, no new file
  const openEditDialog = () => {
    openCropDialog(bannerUrl);
  };

  // Apply: set position, upload file to UploadThing in background
  const handleCropApply = async (objectPosition: string) => {
    const fileToUpload = pendingBannerFileRef.current;

    setBannerPosition(objectPosition);
    setPendingBannerSrc("");
    setCropDialogOpen(false);

    if (fileToUpload) {
      // Upload in background — blob URL already showing as preview
      try {
        const res = await startBannerUpload([fileToUpload]);
        const uploadedUrl = res?.[0]?.ufsUrl ?? res?.[0]?.url;
        if (uploadedUrl) {
          revokeObjectUrl(bannerUrl);
          setBannerUrl(uploadedUrl);
          pendingBannerFileRef.current = null;
        }
      } catch {
        toast.error("Failed to upload cover image");
      }
    }
  };

  const handleCropCancel = () => {
    // If a new file was picked but not yet uploaded, revert preview
    if (pendingBannerFileRef.current) {
      revokeObjectUrl(bannerUrl);
      setBannerUrl(previousBannerUrlRef.current);
      pendingBannerFileRef.current = null;
    }
    setPendingBannerSrc("");
    setCropDialogOpen(false);
  };

  const handleRemoveAvatar = async () => {
    try {
      await clearImage.mutateAsync();
      revokeObjectUrl(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = "";
      setAvatarFile(null);
      setForm((prev) => ({ ...prev, image: "" }));
      queryClient.invalidateQueries({ queryKey: [["users", "me"]] });
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  const handleSave = async () => {
    if (!form.fullName || form.fullName.length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    if (!form.username || form.username.length < 2) {
      toast.error("Username must be at least 2 characters");
      return;
    }

    try {
      let imageUrl = form.image;
      // bannerUrl is already the UploadThing URL (set on Apply).
      // If still a blob URL (upload failed), try uploading now.
      let finalBannerUrl = bannerUrl;
      if (bannerUrl.startsWith("blob:") && pendingBannerFileRef.current) {
        const res = await startBannerUpload([pendingBannerFileRef.current]);
        const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
        if (url) {
          revokeObjectUrl(bannerUrl);
          finalBannerUrl = url;
          setBannerUrl(url);
          pendingBannerFileRef.current = null;
        }
      }

      if (avatarFile) {
        const upload = await startAvatarUpload([avatarFile]);
        imageUrl = upload?.[0]?.ufsUrl ?? "";
        if (!imageUrl) throw new Error("Failed to upload profile photo");
        revokeObjectUrl(avatarPreviewUrlRef.current);
        avatarPreviewUrlRef.current = "";
      }

      await updateProfile.mutateAsync({
        fullName: form.fullName,
        username: form.username,
        displayName: form.displayName || null,
        bio: form.bio || null,
        location: form.location || null,
        website: form.website || null,
        twitter: form.twitter || null,
        discord: form.discord || null,
        ...(imageUrl && imageUrl.startsWith("http") ? { image: imageUrl } : {}),
        profileBannerUrl: finalBannerUrl.startsWith("http")
          ? finalBannerUrl
          : null,
        profileBannerPosition: bannerPosition || null,
      });

      setAvatarFile(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      setForm((prev) => ({ ...prev, image: imageUrl }));
      queryClient.invalidateQueries({ queryKey: [["users", "me"]] });
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  if (isLoading) {
    return <RouteLoadingFallback route="settingsProfile" className="min-h-full" />;
  }

  return (
    <div className="flex flex-col w-full">
      <div className="px-6 sm:px-8 pt-4">
        <div className="flex flex-col gap-3 rounded-md border border-white/5 bg-sidebar p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Edit profile</p>
            <p className="mt-1 text-sm text-white/45">
              Profile styling has moved into the customization shop.
            </p>
          </div>
          <Link
            href="/dashboard/settings/shop"
            className="inline-flex h-9 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.06]"
          >
            Open shop
          </Link>
        </div>
      </div>
      <Separator />

      {/* Cover / Banner */}
      <div
            ref={bannerContainerRef}
            className="relative h-52 md:h-64 bg-sidebar-accent"
            style={
              !bannerUrl
                ? { backgroundImage: DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE }
                : undefined
            }
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Banner"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: bannerPosition }}
              />
            )}

            {/* Upload loading overlay */}
            {isBannerUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <Loader2 className="size-5 text-white animate-spin" />
              </div>
            )}

            {/* Hover controls */}
            {!isBannerUploading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity bg-black/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white bg-black/50 hover:bg-black/70 cursor-pointer"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  <ImagePlus className="size-4 mr-1.5" />
                  {bannerUrl ? "Change cover" : "Add cover image"}
                </Button>
                {bannerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white bg-black/50 hover:bg-black/70 cursor-pointer"
                    onClick={openEditDialog}
                    disabled={bannerIsGif}
                  >
                    <Pencil className="size-4 mr-1.5" />
                    {bannerIsGif ? "GIF covers can't be cropped" : "Edit cover"}
                  </Button>
                )}
                {bannerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white bg-black/50 hover:bg-black/70 cursor-pointer"
                    onClick={() => {
                      pendingBannerFileRef.current = null;
                      revokeObjectUrl(bannerUrl);
                      setBannerUrl("");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            )}

           <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerChange}
            />
          </div>

          <div className="px-6 sm:px-8 pt-2">
            <p className="text-xs text-white/40">
              Cover images support still images for everyone. Elite can upload animated GIF banners.
            </p>
          </div>

          {/* Avatar overlapping banner */}
          <div className="px-6 sm:px-8 -mt-10 pb-6">
            <div className="relative group w-max">
              <Avatar className="size-20 rounded-full ring-4 ring-sidebar shadow-lg">
                {form.image ? (
                  <AvatarImage
                    src={form.image}
                    alt={form.fullName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-foreground text-xl font-semibold">
                  {form.fullName?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="size-5 text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <Separator />

          {/* Profile Photo */}
          <div className="flex flex-col items-start gap-2 sm:gap-4 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Profile photo
              </Label>
              <p className="text-xs text-white/40 mt-0.5">
                This photo will be visible to others. Elite can upload animated GIFs.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Avatar className="size-14 rounded-full shadow-lg shrink-0">
                {form.image ? (
                  <AvatarImage
                    src={form.image}
                    alt={form.fullName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-foreground text-lg font-semibold">
                  {form.fullName?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button
                  className="ring ring-teal-500/25 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="size-3.5" />
                  Upload new image
                </Button>
                {form.image && (
                  <Button
                    className="ring ring-red-500/25 bg-red-600/15 hover:bg-red-600/25 px-4 py-2 h-[38px] w-max text-xs text-red-400 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 className="size-3.5" />
                    Delete current image
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">Full name</Label>
              <p className="text-xs text-white/40 mt-0.5">Your display name.</p>
            </div>
            <Input
              value={form.fullName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fullName: e.target.value }))
              }
              placeholder="John Doe"
              className="bg-sidebar-accent ring-white/5 text-white"
            />
          </div>

          <Separator />

          {/* Username */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">Username</Label>
              <p className="text-xs text-white/40 mt-0.5">
                A unique name for your profile.
              </p>
            </div>
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs text-white/40 bg-sidebar-accent ring ring-white/5 ring-r-0 rounded-l-md whitespace-nowrap border-none!">
                profitabledge.com/
              </span>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    username: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]/g, ""),
                  }))
                }
                placeholder="johndoe"
                className="bg-sidebar-accent ring-white/5 text-white rounded-l-none"
              />
            </div>
          </div>

          <Separator />

          {/* Display Name */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Display name
              </Label>
              <p className="text-xs text-white/40 mt-0.5">
                Used across your account and shareable proof surfaces.
              </p>
            </div>
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              placeholder="Optional display name"
              className="bg-sidebar-accent ring-white/5 text-white"
            />
          </div>

          <Separator />

          {/* About you */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">About you</Label>
              <p className="text-xs text-white/40 mt-0.5">
                Write a description for your profile.
              </p>
            </div>
            <div className="space-y-1.5">
              <Textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="I'm a trader who..."
                rows={3}
                maxLength={500}
                className="ring-white/5 text-white resize-none text-xs! bg-transparent!"
              />
              <p className="text-[11px] text-white/30 text-right">
                {form.bio.length}/500
              </p>
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">Location</Label>
              <p className="text-xs text-white/40 mt-0.5">Where you trade from.</p>
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="e.g., London, UK"
                className="bg-sidebar-accent ring-white/5 text-white pl-9"
              />
            </div>
          </div>

          <Separator />

          {/* Connect socials heading */}
          <div className="px-6 sm:px-8 py-5">
            <h2 className="text-sm font-semibold text-white">
              Connect with your socials
            </h2>
            <p className="text-xs text-white/40 mt-0.5">Add your social links.</p>
          </div>

          <Separator />

          {/* X (Twitter) */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div className="flex items-center gap-2.5">
              <div className="size-5 flex items-center justify-center">
                <XIcon className="size-3.5 text-white" />
              </div>
              <Label className="text-sm text-white/80 font-medium">
                X (Twitter)
              </Label>
            </div>
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs text-white/40 bg-sidebar-accent ring ring-white/5 ring-r-0 rounded-l-md whitespace-nowrap">
                x.com/
              </span>
              <Input
                value={form.twitter}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, twitter: e.target.value }))
                }
                placeholder="handle"
                className="bg-sidebar-accent ring-white/5 text-white rounded-l-none"
              />
            </div>
          </div>

          <Separator />

          {/* Discord */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div className="flex items-center gap-2.5">
              <LinkIcon className="size-4 text-indigo-400" />
              <Label className="text-sm text-white/80 font-medium">Discord</Label>
            </div>
            <Input
              value={form.discord}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, discord: e.target.value }))
              }
              placeholder="username#0000"
              className="bg-sidebar-accent ring-white/5 text-white"
            />
          </div>

          <Separator />

          {/* Save */}
          <div className="flex justify-end px-6 sm:px-8 py-6">
            <Button
              onClick={handleSave}
              disabled={
                updateProfile.isPending || isAvatarUploading || isBannerUploading
              }
              className="cursor-pointer flex h-9 w-max items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white ring ring-white/5 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateProfile.isPending || isAvatarUploading || isBannerUploading
                ? "Saving..."
                : "Save changes"}
            </Button>
          </div>

      {pendingBannerSrc && (
        <CoverImageCropDialog
          open={cropDialogOpen}
          imageSrc={pendingBannerSrc}
          frameDimensions={bannerDimensions}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
