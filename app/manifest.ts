import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest). Makes the dashboard installable
 * to a phone home screen. Icons reference files in /public (add when branding is ready).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simplify2 — Sales Tracker",
    short_name: "Simplify2",
    description: "Automated small-business sales tracking from WhatsApp receipts.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
