import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevReplay",
  description: "Explore AI-assisted coding sessions as evidence-linked workflows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
