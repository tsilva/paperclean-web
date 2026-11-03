import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/legal"].map((path) => ({ url: `https://paperclean.tsilva.eu${path}` }));
}
