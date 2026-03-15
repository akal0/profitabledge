import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function GrowthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col">
      <div className="px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="text-base font-medium tracking-[-0.04em] text-white/40 sm:text-sm">
            {description}
          </p>
        </div>
      </div>

      <Separator />

      {children}
    </div>
  );
}

export function GrowthPageBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-6 py-5 sm:px-8", className)}>{children}</div>;
}

export function GrowthCardShell({
  className,
  innerClassName,
  children,
}: {
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col rounded-sm bg-sidebar p-1.5 ring ring-white/5 shadow-sidebar-button",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-1 flex-col rounded-sm bg-sidebar-accent",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function GrowthSectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-sm font-medium tracking-[-0.04em] text-white/35">
      {children}
    </p>
  );
}
