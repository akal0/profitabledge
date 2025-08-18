"use client";
import { cn } from "@/lib/utils";
import { motion, useSpring, useTransform } from "motion/react";
import type { SpringOptions } from "motion/react";
import { useEffect } from "react";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: React.ElementType;
  format?: (n: number) => string;
};

export function AnimatedNumber({
  value,
  className,
  springOptions,
  as = "span",
  format,
}: AnimatedNumberProps) {
  const MotionComponent = motion.create(as as any);

  const spring = useSpring(value, springOptions);
  const display = useTransform(spring, (current) =>
    format ? format(current) : current.toLocaleString(undefined)
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <MotionComponent className={cn(className)}>{display}</MotionComponent>;
}
