import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camp Rise Again",
  description: "Apply to attend Camp Rise Again or volunteer to support an upcoming camp season.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
