import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthGuard } from "@/components/auth-guard";
import { Toaster } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PWAInstaller } from "@/components/pwa-installer";
import { OfflineCacheManager } from "@/components/offline-cache-manager";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS System",
  description: "Offline-first Point of Sale System",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="register-sw" strategy="beforeInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(registration) {
                    console.log('✅ SW registered:', registration.scope);
                  })
                  .catch(function(error) {
                    console.error('❌ SW registration failed:', error);
                  });
              });
            }
          `}
        </Script>
        <Providers>
          <OfflineIndicator />
          <PWAInstaller />
          <OfflineCacheManager />
          <AuthGuard>{children}</AuthGuard>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
