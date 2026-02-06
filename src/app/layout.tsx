import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POST_CORE | Mission Control",
  description: "X Neural Analytics Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#050506] text-[#e0e0e0] overflow-x-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
