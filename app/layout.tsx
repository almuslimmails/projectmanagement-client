import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tathkarah Project Tracker",
  description: "Track projects, milestones, and tasks for your team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-color-mode="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        {/* Global release-status tag — visible on every screen (sign-in included) */}
        <span
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] pointer-events-none select-none inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-white bg-amber-500 px-2 py-0.5 rounded-md shadow-md ring-1 ring-amber-600/40"
          title="This is the Test environment — expect breaking changes"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
          Test
        </span>
        {children}
      </body>
    </html>
  );
}
