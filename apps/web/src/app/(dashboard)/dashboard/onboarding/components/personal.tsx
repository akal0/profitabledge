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
import { trpcClient } from "@/utils/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import AvatarUploader from "./avatar-uploader";
import AvatarUploader from "./avatar-uploader";
import { uploadFiles } from "@/utils/uploadthing";
import { ArrowRightIcon } from "lucide-react";

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
    });

    toast.success("Profile updated");
    onNext();
  }

  const getInfo = async () => {
    const me = await trpcClient.users.me.query();

    return me;
  };

  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getInfo();
      setMe(data);
      form.reset({
        fullName: data?.name ?? "",
        username: data?.username ?? "",
        email: data?.email ?? "",
        avatar: null,
        twitter: "",
        discord: "",
      });
    })();
  }, []);

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
                  userId={me?.id}
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
                    <Input placeholder="Profitable Trader" {...field} />
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
                      <div className="flex rounded-md ">
                        <span className="bg-sidebar text-secondary z-0 inline-flex items-center rounded-s-md px-3 text-xs shadow-sidebar-button shadow-none">
                          profitabledge.com/
                        </span>
                        <Input
                          className="-ms-px rounded-s-none !border-none relative z-10"
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
                          className="size-3.5 mr-2 stroke-white group-hover:fill-white transition duration-500"
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
                          className="size-3.5 mr-2 stroke-white group-hover:fill-white transition duration-500"
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
              className="shadow-sidebar-button rounded-[6px] h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center w-full"
              type="submit"
            >
              Update
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Personal;
