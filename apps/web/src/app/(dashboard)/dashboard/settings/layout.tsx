import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-12">{children}</div>
      </div>
    </Suspense>
  );
}
