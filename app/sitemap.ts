import type {MetadataRoute} from "next";
import {tools} from "@/content/tools";
import {routing} from "@/lib/i18n/routing";
import {absoluteUrl} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const homePages = routing.locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 1
  }));

  const toolPages = routing.locales.flatMap((locale) =>
    Object.keys(tools).map((slug) => ({
      url: absoluteUrl(`/${locale}/${slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  );

  return [...homePages, ...toolPages];
}
