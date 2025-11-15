import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Appointment Booking",
  description: "Book appointments with doctors using voice or text",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

