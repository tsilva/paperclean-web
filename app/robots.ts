import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/history"] }, sitemap: "https://paperclean.tsilva.eu/sitemap.xml" };
}
