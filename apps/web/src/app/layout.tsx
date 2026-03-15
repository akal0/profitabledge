import type { Metadata } from "next";
// import "@uploadthing/react/styles.css";
import "../index.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "profitabledge",
  description: "profitabledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden">
        <Providers>
          <div className="flex h-screen w-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
