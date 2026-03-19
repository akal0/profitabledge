"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import X from "@/public/icons/social-media/x.svg";
import Discord from "@/public/icons/social-media/discord.svg";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import AvatarUploader from "./avatar-uploader";
import { useQuery } from "@tanstack/react-query";
import { getOnboardingButtonClassName } from "@/features/onboarding/lib/onboarding-button-styles";

type Me = Awaited<ReturnType<typeof trpcClient.users.me.query>>;

const FormSchema = z.object({
  username: z.string().trim().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  avatar: z.any().optional().nullable(),
  twitter: z.string().optional().nullable(),
  discord: z.string().optional().nullable(),
});

function sanitizeUsernameCandidate(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function deriveUsername(me: Me | undefined, sessionUser: {
  email?: string | null;
  name?: string | null;
} | null | undefined) {
  const fromProfile = sanitizeUsernameCandidate(me?.username);
  if (fromProfile.length >= 2) {
    return fromProfile;
  }

  const profileName =
    me?.name && me.name !== "placeholder" ? me.name : sessionUser?.name;
  const fromName = sanitizeUsernameCandidate(profileName);
  if (fromName.length >= 2) {
    return fromName;
  }

  const fromEmail = sanitizeUsernameCandidate(
    (me?.email ?? sessionUser?.email ?? "").split("@")[0]
  );
  return fromEmail;
}

function deriveDisplayName(
  me: Me | undefined,
  sessionUser: { name?: string | null } | null | undefined,
  username: string
) {
  const profileName = me?.name?.trim();
  if (profileName && profileName !== "placeholder") {
    return profileName;
  }

  const sessionName = sessionUser?.name?.trim();
  if (sessionName && sessionName !== "placeholder") {
    return sessionName;
  }

  return username;
}

const Personal = ({ onNext }: { onNext: () => void }) => {
  const { data: session } = authClient.useSession();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      avatar: null,
      username: "",
      twitter: "",
      discord: "",
    },
  });
  const hydratedDefaultsRef = useRef<string | null>(null);

  const uploaderApiRef = useRef<null | {
    pick: () => void;
    clear: () => void;
    getFile: () => File | null;
    upload: () => Promise<string | null>;
  }>(null);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    // If avatar file selected, upload now and capture URL
    let imageUrl: string | null = null;
    if (uploaderApiRef.current?.getFile()) {
      imageUrl = (await uploaderApiRef.current.upload()) || null;
    }

    const username = data.username.trim();
    const fullName = deriveDisplayName(me, session?.user, username);

    await trpcClient.users.updateProfile.mutate({
      fullName,
      username,
      image: imageUrl || (data.avatar as string | null) || undefined,
      twitter: data.twitter?.trim() || null,
      discord: data.discord?.trim() || null,
    });
    await queryClient.invalidateQueries({ queryKey: [["users", "me"]] });

    toast.success("Profile updated");
    onNext();
  }

  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    enabled: Boolean(session?.user),
    staleTime: 5 * 60_000,
  });

  const email = me?.email ?? session?.user.email ?? "";
  const username = useMemo(
    () => deriveUsername(me, session?.user),
    [me, session?.user]
  );

  useEffect(() => {
    if (!session?.user && !me) {
      return;
    }

    const defaultsKey = [
      me?.id ?? session?.user.id ?? "",
      username,
      email,
      me?.twitter ?? "",
      me?.discord ?? "",
    ].join("|");

    if (!defaultsKey || hydratedDefaultsRef.current === defaultsKey) {
      return;
    }

    if (form.formState.isDirty) {
      return;
    }

    hydratedDefaultsRef.current = defaultsKey;
    form.reset({
      username,
      avatar: null,
      twitter: me?.twitter ?? "",
      discord: me?.discord ?? "",
    });
  }, [email, form, form.formState.isDirty, me, session?.user, username]);

  return (
    <div className="w-full max-w-lg bg-sidebar rounded-xl shadow-sidebar-button">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-6 py-6"
        >
          <FormField
            control={form.control}
            name="avatar"
            render={() => (
              <FormItem className="px-10 space-y-1 flex flex-col">
                <FormLabel className="text-xs">Profile picture</FormLabel>

                <AvatarUploader
                  onUploaded={(url) => form.setValue("avatar", url)}
                  initialUrl={me?.image ?? undefined}
                  fallbackLabel={me?.email ?? ""}
                  onReady={(api) => (uploaderApiRef.current = api)}
                />

                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />
          <div className="px-10 space-y-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Username</FormLabel>
                  <FormControl>
                    <div className="*:not-first:mt-2 rounded-md ring ring-white/0">
                      <div className="flex rounded-md">
                        <span className="bg-sidebar text-secondary z-10 inline-flex items-center px-3 text-xs ring ring-white/5 border-r-0 rounded-l-md pointer-events-none select-none">
                          profitabledge.com/
                        </span>
                        <Input
                          className="bg-sidebar relative focus-visible:scale-[100%] rounded-l-none z-0"
                          placeholder="profitabletrader"
                          type="text"
                          {...field}
                        />
                      </div>
                    </div>
                    {/* <Input placeholder="shadcn" {...field} /> */}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1">
              <FormLabel className="text-xs">Email</FormLabel>
              <Input
                value={email}
                readOnly
                disabled
                className="cursor-not-allowed opacity-70"
                placeholder="profitabletrader@gmail.com"
              />
            </div>
          </div>

          <Separator />

          <div className="flex gap-4 px-10">
            {/* Twitter */}

            <FormField
              control={form.control}
              name="twitter"
              render={({ field }) => (
                <FormItem className="space-y-1 flex-1">
                  <FormLabel className="text-xs">Twitter</FormLabel>

                  <FormControl>
                    <div className="relative group">
                      <Input
                        className="peer ps-12 hover:!scale-100 focus:!scale-100"
                        placeholder="Twitter"
                        {...field}
                        value={field.value ?? ""}
                      />

                      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center peer-disabled:opacity-50 ps-3 pt-[1.5px] pb-[0.5px]">
                        <X
                          className="size-3.5 mr-2 fill-white group-hover:fill-white transition duration-500"
                          aria-hidden="true"
                        />

                        <div className="h-full bg-black/50 w-[2px] border-r border-[#333333]/50"></div>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discord */}

            <FormField
              control={form.control}
              name="discord"
              render={({ field }) => (
                <FormItem className="space-y-1 flex-1">
                  <FormLabel className="text-xs">Discord</FormLabel>

                  <FormControl>
                    <div className="relative group">
                      <Input
                        className="peer ps-12 hover:!scale-100 focus:!scale-100"
                        placeholder="Discord"
                        {...field}
                        value={field.value ?? ""}
                      />

                      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center peer-disabled:opacity-50 ps-3 pt-[1.5px] pb-[0.5px]">
                        <Discord
                          className="size-3.5 mr-2 fill-white group-hover:fill-white transition duration-500"
                          aria-hidden="true"
                        />

                        <div className="h-full bg-black/50 w-[2px] border-r border-[#333333]/50"></div>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div className="flex gap-4 px-6">
            <Button
              className={getOnboardingButtonClassName({
                tone: "teal",
                className: "w-full flex-1",
              })}
              type="submit"
            >
              Update profile
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Personal;
