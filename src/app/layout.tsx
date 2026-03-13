import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TimeThemeProvider } from "@/components/time-theme-provider";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TOYS — Tesis Operasyon Yönetimi",
  description:
    "Mıcır kırma, eleme ve yıkama tesisi operasyon yönetim sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      {/*
        Senkron script: React hidrasyonu başlamadan önce çalışır,
        tema flaşını (FOUC) önler.
        07:00–20:00 → light (dark class yok)
        20:00–07:00 → dark  (dark class eklenir)
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var mode='auto';try{var stored=localStorage.getItem('toys-theme-mode');if(stored==='light'||stored==='dark'||stored==='auto'){mode=stored;}}catch(e){}var h=new Date().getHours();var autoDark=(h<7||h>=20);var shouldDark=(mode==='dark')||(mode==='auto'&&autoDark);if(shouldDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}})();`,
          }}
        />
      </head>
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <TimeThemeProvider />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
