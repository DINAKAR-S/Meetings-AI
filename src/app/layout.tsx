import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import CommandPalette from "@/components/CommandPalette";

import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "SprintMind – AI Meeting Intelligence",
  description:
    "Convert meeting conversations into structured Agile sprint tasks automatically. AI-powered project management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `}</style>
      </head>
      <body suppressHydrationWarning>
        <ToastProvider>
          <CommandPalette />
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <TopBar />
              <div className="page-content">{children}</div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
