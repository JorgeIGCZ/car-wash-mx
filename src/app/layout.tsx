import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turbo Wash",
  description: "Registro y control de servicios de Turbo Wash Auto Spa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
