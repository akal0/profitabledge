import type { Metadata } from "next";
// import "@uploadthing/react/styles.css";
import "../index.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "profitabledge — Turn your trading data into your profitable edge",
    template: "pe - %s",
  },
  description:
    "Track, analyse, and improve your trading performance. Import trades from MT5 and other brokers, journal your setups, and discover the edge that makes you consistently profitable.",
  metadataBase: new URL("https://profitabledge.com"),
  openGraph: {
    title: "profitabledge — Turn your trading data into your profitable edge",
    description:
      "Track, analyse, and improve your trading performance. Import trades from MT5 and other brokers, journal your setups, and discover the edge that makes you consistently profitable.",
    url: "https://profitabledge.com",
    siteName: "profitabledge",
    images: [
      {
        url: "/profitabledge.png",
        width: 3564,
        height: 1884,
        alt: "profitabledge dashboard preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "profitabledge — Turn your trading data into your profitable edge",
    description:
      "Track, analyse, and improve your trading performance. Import trades from MT5 and other brokers, journal your setups, and discover the edge that makes you consistently profitable.",
    images: ["/profitabledge.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans antialiased overflow-x-hidden">
        <Providers>
          <div className="flex h-screen w-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
