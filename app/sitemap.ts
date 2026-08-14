import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/legal"].map((path) => ({ url: `https://paperclean.tsilva.eu${path}`, lastModified: new Date(), changeFrequency: path ? "monthly" : "weekly", priority: path ? 0.5 : 1 }));
}
