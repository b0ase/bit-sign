import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bit-Sign — Document Signing on Bitcoin",
  description: "Sign documents with blockchain-verified proof. Fast, secure, and permanent.",
  openGraph: {
    title: "Bit-Sign — Document Signing on Bitcoin",
    description: "Sign documents with blockchain-verified proof. Fast, secure, and permanent.",
    images: [{ url: "/bit-sign-online.jpg" }],
    siteName: "Bit-Sign",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bit-Sign — Document Signing on Bitcoin",
    description: "Sign documents with blockchain-verified proof. Fast, secure, and permanent.",
    images: ["/bit-sign-online.jpg"],
  },
};

import Navbar from "@/components/Navbar";

import Footer from "@/components/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} antialiased selection:bg-white selection:text-black bg-[#050505] text-white pt-16 font-sans`}>
        <div className="relative z-10">
          <Navbar />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
