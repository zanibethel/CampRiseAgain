import type { Metadata } from "next";
import "./globals.css";
import VisitorAnalytics from "@/components/VisitorAnalytics";

export const metadata: Metadata = {
  title: "Camp Rise Again",
  description: "Camp Rise Again honors the lost and protects the living through an outdoor peer-support camp focused on men's mental health, connection, and hope.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <VisitorAnalytics />
      </body>
    </html>
  );
}
