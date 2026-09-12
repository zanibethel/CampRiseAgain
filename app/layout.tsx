import type { Metadata } from "next";
import "./globals.css";
import AdminGoFundMeGate from "@/components/AdminGoFundMeGate";

export const metadata: Metadata = {
  title: "Camp Rise Again",
  description: "Camp Rise Again is an adult camp creating a safe, supportive space for people struggling with depression to reconnect, find community, and take another step forward together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AdminGoFundMeGate />
      </body>
    </html>
  );
}
