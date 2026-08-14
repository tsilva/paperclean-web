import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "PaperClean", short_name: "PaperClean", description: "Conservative document cleanup", start_url: "/", display: "standalone", background_color: "#f8f6f2", theme_color: "#06152d", icons: [{ src: "/brand/paperclean-mark.png", sizes: "1024x1024", type: "image/png" }] };
}
