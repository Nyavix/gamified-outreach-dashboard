import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gamified Outreach Dashboard",
  description: "Track outreach, calls booked, and deals closed — gamified.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
