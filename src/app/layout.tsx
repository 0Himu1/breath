import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Breath",
  description: "A quiet rhythmic breathing pacer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
