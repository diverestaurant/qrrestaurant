export const supportedLocales = ["en", "zh", "ms"] as const;
export type AppLocale = (typeof supportedLocales)[number];

export const localePolicy = {
  en: { catalogStatus: "active", htmlLang: "en" },
  zh: { catalogStatus: "pending", htmlLang: "zh-Hans" },
  ms: { catalogStatus: "pending", htmlLang: "ms" },
} as const satisfies Record<AppLocale, { catalogStatus: "active" | "pending"; htmlLang: string }>;

export type LocaleResolution = {
  requestedLocale: AppLocale | null;
  activeLocale: "en";
  htmlLang: "en";
  fallback: boolean;
  reason: "active" | "catalog_pending" | "unsupported";
};

export function isAppLocale(value: string): value is AppLocale {
  return supportedLocales.some((locale) => locale === value);
}

export function resolveLocale(requestedLocale?: string | null): LocaleResolution {
  if (requestedLocale === "en" || !requestedLocale) {
    return { requestedLocale: "en", activeLocale: "en", htmlLang: "en", fallback: false, reason: "active" };
  }
  if (isAppLocale(requestedLocale)) {
    return { requestedLocale, activeLocale: "en", htmlLang: "en", fallback: true, reason: "catalog_pending" };
  }
  return { requestedLocale: null, activeLocale: "en", htmlLang: "en", fallback: true, reason: "unsupported" };
}
