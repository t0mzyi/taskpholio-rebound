"use client";
import "./globals.css";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { SocketProvider } from "@/providers/SocketProvider";
import LogRocketInit from "@/components/LogRocketInit";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const shouldRegisterSW =
      "serviceWorker" in navigator &&
      (process.env.NODE_ENV === "production" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    if (shouldRegisterSW) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then((registration) => {
            console.log("✅ Service Worker registered:", registration.scope);
          })
          .catch((error) => {
            console.error("❌ Service Worker registration failed:", error);
          });
      });
    }

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b1020" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Taskpholio" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <LogRocketInit />
        <SocketProvider>
          {children}
        </SocketProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
