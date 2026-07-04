import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Turbo Wash Auto Spa",
    short_name: "Turbo Wash",
    description: "Registro y control de servicios de Turbo Wash Auto Spa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101114",
    theme_color: "#101114",
    orientation: "portrait",
    lang: "es-MX",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
