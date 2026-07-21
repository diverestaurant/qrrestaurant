import { describe, expect, it } from "vitest";
import { englishCatalog, messageKeys, previewMessage, pseudoLongEnglish, translate } from "@/modules/i18n/application/catalog";
import { resolveLocale, supportedLocales } from "@/modules/i18n/contracts/locales";

describe("locale policy", () => {
  it("keeps every declared locale on a safe, complete catalog", () => {
    expect(supportedLocales.map((locale) => resolveLocale(locale))).toEqual([
      { requestedLocale: "en", activeLocale: "en", htmlLang: "en", fallback: false, reason: "active" },
      { requestedLocale: "zh", activeLocale: "en", htmlLang: "en", fallback: true, reason: "catalog_pending" },
      { requestedLocale: "ms", activeLocale: "en", htmlLang: "en", fallback: true, reason: "catalog_pending" },
    ]);
  });

  it("falls back safely for an unsupported locale", () => {
    expect(resolveLocale("fr")).toMatchObject({ requestedLocale: null, activeLocale: "en", fallback: true, reason: "unsupported" });
  });
});

describe("English launch catalog", () => {
  it("contains non-empty content for every semantic key", () => {
    expect(Object.keys(englishCatalog).sort()).toEqual([...messageKeys].sort());
    expect(messageKeys.every((key) => translate(key).trim().length > 0)).toBe(true);
  });

  it("interpolates known values and leaves missing placeholders visible", () => {
    expect(translate("localization.fallbackNotice", { requestedLocale: "Chinese" })).toContain("Chinese catalog");
    expect(translate("localization.fallbackNotice")).toContain("{requestedLocale}");
  });
});

describe("pseudo-long layout content", () => {
  it("expands representative copy by 30–50 percent", () => {
    const source = translate("localization.sampleDescription", { branchName: "Waterfront" });
    const expanded = previewMessage("en-XA", "localization.sampleDescription", { branchName: "Waterfront" });
    expect(expanded.length / source.length).toBeGreaterThanOrEqual(1.3);
    expect(expanded.length / source.length).toBeLessThanOrEqual(1.5);
  });

  it("preserves interpolation placeholders for later substitution", () => {
    expect(pseudoLongEnglish("Review {count} orders before close.")).toContain("{count}");
  });
});
