import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/supabase/config";

const routes = ["", "/about", "/events", "/projects", "/committee", "/resources", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: getSiteUrl(route || "/"),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
