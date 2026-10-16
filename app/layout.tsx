import type { Metadata } from "next";
import "./globals.css";
import VisitorAnalytics from "@/components/VisitorAnalytics";

export const metadata: Metadata = {
  title: "Camp Rise Again",
  description: "Camp Rise Again is a peer-support adult camp where people experiencing depression and isolation can find connection, encouragement, and shared experiences.",
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
