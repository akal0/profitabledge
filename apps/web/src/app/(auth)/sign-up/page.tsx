"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AvatarUpload from "@/components/upload/AvatarUpload";

import { OverlapSeparator, Separator } from "@/components/ui/separator";
import Link from "next/link";

import Google from "@/public/icons/social-media/google.svg";
import X from "@/public/icons/social-media/x.svg";
import Discord from "@/public/icons/social-media/discord.svg";
import { cn } from "@/lib/utils";
import PasswordInput from "./components/password-input";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, CircleCheckIcon, XIcon } from "lucide-react";

const FormSchema = z.object({
  email: z.string().email({
    message: "Invalid email address.",
  }),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters.",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least 1 lowercase letter.",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least 1 uppercase letter.",
    })
    .regex(/[0-9]/, {
      message: "Password must contain at least 1 number.",
    }),
});

const SignupPage = () => {
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await authClient.signUp.email(
      {
        email: data.email,
        name: "placeholder",
        password: data.password,
      },
      {
        onSuccess: () => {
          toast.custom((t) => (
            <div className="bg-sidebar shadow-sidebar-button text-foreground w-full rounded-md px-4 py-3 shadow-lg sm:w-[var(--width)]">
              <div className="flex gap-2">
                <div className="flex grow gap-3">
                  <CircleCheckIcon
                    className="mt-0.5 shrink-0 text-emerald-500"
                    size={16}
                    aria-hidden="true"
                  />
                  <div className="flex grow justify-between gap-12">
                    <p className="text-sm text-white font-medium">
                      Account successfully created!
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                  onClick={() => toast.dismiss(t)}
                  aria-label="Close banner"
                >
                  <XIcon
                    size={16}
                    className="opacity-60 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </div>
          ));

          router.push("/dashboard/onboarding");
        },
        onError: (error) => {
          toast.custom((t) => (
            <div className="bg-sidebar shadow-sidebar-button text-foreground w-full rounded-md px-4 py-3 shadow-lg sm:w-[var(--width)]">
              <div className="flex gap-2">
                <div className="flex grow gap-3">
                  <CircleAlertIcon
                    className="mt-0.5 shrink-0 text-red-500"
                    size={16}
                    aria-hidden="true"
                  />
                  <div className="flex grow justify-between gap-12">
                    <p className="text-sm text-white font-medium">
                      Uh oh! There's been a problem.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                  onClick={() => toast.dismiss(t)}
                  aria-label="Close banner"
                >
                  <XIcon
                    size={16}
                    className="opacity-60 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </div>
          ));
        },
      }
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen relative">
      <div
        className={cn(
          "z-99 opacity-25 absolute size-106 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-98 opacity-25 absolute size-116 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-97 opacity-25 absolute size-126 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:35s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-96 opacity-25 absolute size-136 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-28 before:-left-28 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-3px)] after:h-[calc(100%-3px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-95 opacity-25 absolute size-146 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-32 before:-left-32 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div className="flex flex-col items-center justify-center gap-8 h-full w-full relative z-100">
        {/* Form */}
        <div className="w-full max-w-md bg-sidebar rounded-3xl shadow-sidebar-button">
          <div className="flex flex-col items-center justify-center gap-1 py-6">
            <h1 className="text-lg font-medium"> Sign up</h1>
            <p className="text-xs text-secondary">
              Take the first step to profitability.
            </p>
          </div>

          <Separator />

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6 py-6"
            >
              {/* Existing fields */}
              <div className="p-10 py-0 space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="profitabletrader@gmail.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="space-y-8 flex flex-col items-end">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1 w-full">
                        <FormLabel className="text-xs">Password</FormLabel>
                        <FormControl>
                          <PasswordInput {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="px-10 my-6 space-y-4">
                <Button
                  className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full"
                  type="submit"
                >
                  Sign up
                </Button>

                <Link
                  href="/"
                  className="text-xs underline underline-offset-2 text-secondary hover:text-white transition-colors duration-250"
                >
                  Forgot your password?
                </Link>
              </div>

              <OverlapSeparator> Or sign up with </OverlapSeparator>

              <div className="flex items-center justify-center gap-2 px-10 py-2 pb-0">
                <Button className="shadow-sidebar-button rounded-[6px] gap-2 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full group">
                  <Google className="stroke-secondary fill-secondary group-hover:stroke-white group-hover:fill-white transition-colors duration-250" />
                  <p className="text-xs text-secondary group-hover:text-white duration-250">
                    Sign up with Google
                  </p>
                </Button>

                <Button className="shadow-sidebar-button rounded-[6px] gap-2 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full group">
                  <X className="stroke-secondary fill-secondary group-hover:stroke-white group-hover:fill-white transition-colors duration-250" />
                  <p className="text-xs text-secondary group-hover:text-white duration-250">
                    Sign up with X
                  </p>
                </Button>
              </div>

              <Separator />

              <p className="text-xs text-center text-secondary">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-white underline underline-offset-2"
                >
                  Login.{" "}
                </Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
