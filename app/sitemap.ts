import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { eventIsOpen } from "@/lib/beyond-firewall";
import { eventPublicConfig } from "@/lib/event-registration-server";
import { getSiteUrl } from "@/lib/supabase/config";

const routes = ["", "/about", "/events", "/projects", "/committee", "/resources", "/contact", "/terms", "/privacy", "/cookies", "/disclaimer"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const event = eventPublicConfig();
  const activeRoutes = event && eventIsOpen(event.end) ? [...routes, "/events/beyond-the-firewall"] : routes;
  return activeRoutes.map((route) => ({
    url: getSiteUrl(route || "/"),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
