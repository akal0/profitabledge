"use client";

import { useId, useRef, useState, useEffect } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ThemeSwitcher() {
  const id = useId();
  const { setTheme, resolvedTheme } = useTheme();
  const [checked, setChecked] = useState<boolean>(false);
  const switchRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (resolvedTheme) {
      setChecked(resolvedTheme === "light");
    }
  }, [resolvedTheme]);

  const handleThemeChange = async (newChecked: boolean) => {
    if (!switchRef.current) return;

    const nextTheme = newChecked ? "light" : "dark";

    await (document as any).startViewTransition?.(() => {
      flushSync(() => {
        setTheme(nextTheme);
        setChecked(newChecked);
      });
    })?.ready;

    const { top, left, width, height } =
      switchRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 1000,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  return (
    <div>
      <div className="relative inline-grid h-9 grid-cols-[1fr_1fr] items-center text-sm font-medium">
        <Switch
          ref={switchRef}
          id={id}
          checked={checked}
          onCheckedChange={handleThemeChange}
          className="peer data-[state=unchecked]:bg-sidebar border-[0.5px] border-white/5 p-1 shadow-primary-button absolute inset-0 h-[inherit] w-auto [&_span]:z-10 [&_span]:h-full [&_span]:w-1/2 [&_span]:transition-transform [&_span]:duration-500 [&_span]:ease-[cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=checked]:translate-x-full [&_span]:data-[state=checked]:rtl:-translate-x-full"
        />
        <span className="pointer-events-none relative ms-0.5 flex min-w-8 items-center justify-center text-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:invisible peer-data-[state=unchecked]:translate-x-full peer-data-[state=unchecked]:rtl:-translate-x-full ">
          <MoonIcon className="size-3" aria-hidden="true" />
        </span>
        <span className="peer-data-[state=checked]:text-background pointer-events-none relative me-0.5 flex min-w-8 items-center justify-center text-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:-translate-x-full peer-data-[state=unchecked]:invisible peer-data-[state=checked]:rtl:translate-x-full ">
          <SunIcon className="size-3" aria-hidden="true" />
        </span>
      </div>
      <Label htmlFor={id} className="sr-only">
        Labeled switch
      </Label>
    </div>
  );
}
