import { cn } from "@/lib/utils";

export const Separator = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "h-[2px] bg-[#000000]/50 border-b border-[#222225]",
        className
      )}
    />
  );
};

export const OverlapSeparator = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className="flex items-center justify-center gap-2 w-full mt-8 mb-4">
      <div
        className={cn(
          "h-[2px] bg-[#000000]/50 border-b border-[#222225] w-full",
          className
        )}
      />

      <p className="text-xs text-secondary min-w-max">{children}</p>

      <div
        className={cn(
          "h-[2px] bg-[#000000]/50 border-b border-[#222225] w-full",
          className
        )}
      />
    </div>
  );
};

export const CardSeparator = () => {
  return <div className=" h-[3px] bg-[#000000]/25 border-b border-[#333333]" />;
};
