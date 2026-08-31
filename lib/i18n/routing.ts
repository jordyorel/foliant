import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "es", "pt"],
  defaultLocale: "fr",
  localePrefix: "always"
});

export type Locale = (typeof routing.locales)[number];
