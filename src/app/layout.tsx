import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import "./globals.css";

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Fastlønnskalkulator",
  description: "Beregn raskt din lønn basert på timelønn og arbeidstid",
  other: {
    'darkreader-lock': ''
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${ebGaramond.variable} antialiased font-serif`}
      >
        {children}
      </body>
    </html>
  );
}
