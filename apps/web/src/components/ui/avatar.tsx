"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  onError,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const normalizedSrc =
    typeof src === "string" && src.trim().length > 0 ? src.trim() : undefined
  const [resolvedSrc, setResolvedSrc] = React.useState(normalizedSrc)
  const hasRetriedRef = React.useRef(false)

  React.useEffect(() => {
    hasRetriedRef.current = false
    setResolvedSrc(normalizedSrc)
  }, [normalizedSrc])

  if (!resolvedSrc) {
    return null
  }

  return (
    <AvatarPrimitive.Image
      {...props}
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={resolvedSrc}
      referrerPolicy={props.referrerPolicy ?? "no-referrer"}
      onError={(event) => {
        onError?.(event)

        if (!normalizedSrc) {
          setResolvedSrc(undefined)
          return
        }

        if (!hasRetriedRef.current) {
          hasRetriedRef.current = true

          try {
            const url = new URL(normalizedSrc, window.location.origin)
            url.searchParams.set("_avatar", Date.now().toString())
            setResolvedSrc(url.toString())
          } catch {
            const separator = normalizedSrc.includes("?") ? "&" : "?"
            setResolvedSrc(`${normalizedSrc}${separator}_avatar=${Date.now()}`)
          }

          return
        }

        setResolvedSrc(undefined)
      }}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
