import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import Header from "@/components/header";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// ${geistSans.variable} ${geistMono.variable}

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="flex h-screen w-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
