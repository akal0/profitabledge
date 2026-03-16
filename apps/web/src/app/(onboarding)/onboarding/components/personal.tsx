"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import AvatarUpload from "@/components/upload/AvatarUpload";

import X from "@/public/icons/social-media/x.svg";
import Discord from "@/public/icons/social-media/discord.svg";
import Instagram from "@/public/icons/social-media/instagram.svg";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import AvatarUploader from "./avatar-uploader";
import AvatarUploader from "./avatar-uploader";
import { ArrowRightIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Me = Awaited<ReturnType<typeof trpcClient.users.me.query>>;

const FormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 3 characters.",
  }),
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.email().optional(),
  avatar: z.any().optional().nullable(),
  twitter: z.string().optional().nullable(),
  discord: z.string().optional().nullable(),
});

const Personal = ({ onNext }: { onNext: () => void }) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      avatar: null,
      fullName: "",
      username: "",
      email: "",
      twitter: "",
      discord: "",
    },
  });

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

    await trpcClient.users.updateProfile.mutate({
      fullName: data.fullName,
      username: data.username,
      email: data.email || undefined,
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
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!me) return;

    form.reset({
      fullName: me.name ?? "",
      username: me.username ?? "",
      email: me.email ?? "",
      avatar: null,
      twitter: me.twitter ?? "",
      discord: me.discord ?? "",
    });
  }, [form, me]);

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
            render={({ field }) => (
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
          {/* Existing fields */}
          <div className="px-10 space-y-5">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Profitable trader" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Username</FormLabel>
                  <FormControl>
                    <div className="*:not-first:mt-2 rounded-md border-[0.5px] border-white/0">
                      <div className="flex rounded-md overflow-hidden">
                        <span className="bg-sidebar text-secondary z-10 inline-flex items-center px-3 text-xs border border-white/5 border-r-0 rounded-l-md pointer-events-none select-none">
                          profitabledge.com/
                        </span>
                        <Input
                          className=" bg-sidebar relative z-0 focus-visible:scale-[100%] rounded-l-none"
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

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={me?.email ?? "profitabletrader@gmail.com"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              className="rounded-md h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2.5 items-center justify-center w-full"
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
