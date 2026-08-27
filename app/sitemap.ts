import type { MetadataRoute } from "next";
const routes = ["", "/about", "/events", "/projects", "/committee", "/resources", "/contact"];
export default function sitemap(): MetadataRoute.Sitemap { const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grecybersec.example"; return routes.map((route) => ({ url: `${baseUrl}${route}`, lastModified: new Date(), changeFrequency: "weekly", priority: route === "" ? 1 : 0.7 })); }
