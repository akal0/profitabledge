"use client";

import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type CarouselApi = UseEmblaCarouselType[1];

type CarouselProps = ComponentProps<"div"> & {
  setApi?: (api: CarouselApi) => void;
};

export function Carousel({
  className,
  children,
  setApi,
  ...props
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel();

  useEffect(() => {
    if (emblaApi && setApi) {
      setApi(emblaApi);
    }
  }, [emblaApi, setApi]);

  return (
    <div ref={emblaRef} className={cn("overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export function CarouselContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("flex", className)} {...props} />;
}

export function CarouselItem({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("min-w-0 shrink-0 grow-0 basis-full", className)} {...props} />;
}
