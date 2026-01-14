import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Pool Inspection Index",
  description: "Search and view public pool and spa inspection records from cities across the USA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="border-b border-[var(--border)]">
          <nav className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold text-[15px] tracking-tight hover:opacity-70 transition-opacity duration-150"
            >
              Pool Inspection Index
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/explore"
                className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors duration-150"
              >
                Explore
              </Link>
              <Link
                href="/closures"
                className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors duration-150"
              >
                Closures
              </Link>
              <Link
                href="/coverage"
                className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors duration-150"
              >
                Coverage
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-[var(--border)] py-6 mt-auto">
          <div className="container mx-auto max-w-6xl px-4 text-sm text-[var(--foreground-muted)]">
            Data sourced from official government APIs. Updated daily.
          </div>
        </footer>
      </body>
    </html>
  );
}
