import { resolveLocale } from "@/modules/i18n/contracts/locales";

export const messageKeys = [
  "localization.title",
  "localization.description",
  "localization.modeLabel",
  "localization.english",
  "localization.pseudoLong",
  "localization.chineseFallback",
  "localization.malayFallback",
  "localization.activeNotice",
  "localization.pseudoNotice",
  "localization.fallbackNotice",
  "localization.sampleEyebrow",
  "localization.sampleHeading",
  "localization.sampleDescription",
  "localization.sampleAction",
] as const;

export type MessageKey = (typeof messageKeys)[number];
export type MessageVariables = Record<string, string | number>;

export const englishCatalog = {
  "localization.title": "Localization readiness",
  "localization.description": "English is the approved launch catalog. Chinese and Bahasa Melayu remain safely disabled until reviewed content is supplied.",
  "localization.modeLabel": "QA locale preview",
  "localization.english": "English · approved",
  "localization.pseudoLong": "Pseudo-long English · layout QA only",
  "localization.chineseFallback": "Chinese request · English fallback",
  "localization.malayFallback": "Bahasa Melayu request · English fallback",
  "localization.activeNotice": "The approved English catalog is active.",
  "localization.pseudoNotice": "QA-only expanded English is active. This mode is never persisted or shown to customers.",
  "localization.fallbackNotice": "The {requestedLocale} catalog is pending approval, so the complete English catalog is shown.",
  "localization.sampleEyebrow": "Operations sample",
  "localization.sampleHeading": "Review the branch before the business-day cutoff",
  "localization.sampleDescription": "Confirm outstanding orders, service requests, payments, receipts, and reconciliation exceptions for {branchName} before closing the Session.",
  "localization.sampleAction": "Open authoritative operations report",
} satisfies Record<MessageKey, string>;

export function translate(key: MessageKey, variables: MessageVariables = {}) {
  return englishCatalog[key].replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : placeholder,
  );
}

function expansionPadding(length: number) {
  if (length <= 0) return "";
  return ` ${"expanded ".repeat(Math.ceil(length / 9))}`.slice(0, length);
}

export function pseudoLongEnglish(message: string) {
  const targetLength = Math.ceil(message.length * 1.4);
  const paddingLength = Math.max(0, targetLength - message.length - 2);
  return `⟦${message}${expansionPadding(paddingLength)}⟧`;
}

export type PreviewLocale = "en" | "en-XA" | "zh" | "ms";

export function previewMessage(locale: PreviewLocale, key: MessageKey, variables: MessageVariables = {}) {
  const message = translate(key, variables);
  return locale === "en-XA" ? pseudoLongEnglish(message) : message;
}

export function previewLocaleState(locale: PreviewLocale) {
  if (locale === "en-XA") {
    return { activeLocale: "en-XA" as const, htmlLang: "en-XA" as const, fallback: false, reason: "pseudo" as const };
  }
  return resolveLocale(locale);
}
