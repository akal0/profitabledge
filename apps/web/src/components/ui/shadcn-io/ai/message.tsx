import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-start gap-3 py-4",
      from === "user" ? "is-user flex-row-reverse" : "is-assistant",
      "[&>div]:max-w-full",
      className
    )}
    {...(props as any)}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 overflow-hidden rounded-sm px-4 py-3 text-sm border",
      "group-[.is-user]:bg-sidebar group-[.is-user]:border-white/5 group-[.is-user]:text-white",
      "group-[.is-assistant]:bg-sidebar/30 group-[.is-assistant]:border-white/5 group-[.is-assistant]:text-secondary dark:text-neutral-200",
      className
    )}
    {...(props as any)}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar
    className={cn("size-8 shrink-0 self-end", className)}
    {...(props as any)}
  >
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback className="bg-sidebar/50 text-white/70 text-xs">
      {name?.slice(0, 2) || "ME"}
    </AvatarFallback>
  </Avatar>
);
