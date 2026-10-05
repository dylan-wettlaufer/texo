import { themeInitializationScript } from "@/lib/theme";
import type { Metadata } from "next";
import { Ubuntu, Open_Sans, Geist_Mono } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const fontSans = Ubuntu({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-ubuntu",
});

const fontSerif = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Texo — Architecture workspace",
  description: "Explore the architecture, services, and flows behind your code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} h-full`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
      <body className="min-h-full antialiased">
        {children}
      </body>
    </html>
  );
}
