import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kaira Enterprises - Your Local Toy Store",
    template: "%s | Kaira Enterprises",
  },
  description: "Browse our toy collection and order via WhatsApp",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kaira Enterprises",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} font-sans antialiased`}>
        <ThemeProvider>
          <PWAInstallPrompt />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
