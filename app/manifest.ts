import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PaperClean",
    short_name: "PaperClean",
    description: "Conservative document cleanup",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f2",
    theme_color: "#06152d",
    icons: [
      { src: "/brand/paperclean-mark-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/paperclean-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
