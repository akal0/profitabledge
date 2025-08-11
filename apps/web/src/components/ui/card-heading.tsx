import type { ReactNode } from "react";

interface CardHeadingProps {
  children: ReactNode;
  gradientFrom: string;
  gradientTo: string;
}

export function CardHeading({
  children,
  gradientFrom,
  gradientTo,
}: CardHeadingProps) {
  return (
    <h1
      className="text-2xl font-semibold bg-clip-text text-transparent safari-gradient-fix tracking-tight"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      {children}
    </h1>
  );
}
