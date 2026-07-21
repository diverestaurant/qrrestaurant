"use client";

import { useState } from "react";
import { previewLocaleState, previewMessage, translate, type PreviewLocale } from "@/modules/i18n/application/catalog";

const previewOptions: Array<{ value: PreviewLocale; label: string }> = [
  { value: "en", label: translate("localization.english") },
  { value: "en-XA", label: translate("localization.pseudoLong") },
  { value: "zh", label: translate("localization.chineseFallback") },
  { value: "ms", label: translate("localization.malayFallback") },
];

function isPreviewLocale(value: string): value is PreviewLocale {
  return previewOptions.some((option) => option.value === value);
}

export function LocalizationReadiness({ branchName }: { branchName: string }) {
  const [locale, setLocale] = useState<PreviewLocale>("en");
  const state = previewLocaleState(locale);
  const requestedName = locale === "zh" ? "Chinese" : "Bahasa Melayu";
  const notice = state.reason === "pseudo"
    ? translate("localization.pseudoNotice")
    : state.fallback
      ? translate("localization.fallbackNotice", { requestedLocale: requestedName })
      : translate("localization.activeNotice");

  return <section className="mt-6 rounded-2xl border bg-background p-4" aria-labelledby="localization-readiness">
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)] lg:items-end">
      <div className="min-w-0">
        <h3 id="localization-readiness" className="text-base font-semibold">{translate("localization.title")}</h3>
        <p className="mt-2 break-words text-sm leading-6 text-muted">{translate("localization.description")}</p>
      </div>
      <label className="min-w-0 text-sm">{translate("localization.modeLabel")}
        <select className="mt-1 min-h-11 w-full min-w-0 rounded-xl border bg-surface px-3" value={locale} onChange={(event) => { if (isPreviewLocale(event.target.value)) setLocale(event.target.value); }}>
          {previewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand" role="status">{notice}</p>
    <article
      className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-dashed bg-surface p-4"
      data-active-locale={state.activeLocale}
      data-locale-preview={locale}
      data-requested-locale={locale}
      lang={state.htmlLang}
    >
      <p className="break-words text-xs font-semibold tracking-[0.12em] text-brand uppercase">{previewMessage(locale, "localization.sampleEyebrow")}</p>
      <h4 className="mt-2 break-words text-lg font-semibold">{previewMessage(locale, "localization.sampleHeading")}</h4>
      <p className="mt-2 break-words text-sm leading-6 text-muted">{previewMessage(locale, "localization.sampleDescription", { branchName })}</p>
      <button className="mt-4 min-h-11 max-w-full whitespace-normal rounded-full border px-4 py-2 text-sm font-semibold" type="button">{previewMessage(locale, "localization.sampleAction")}</button>
    </article>
  </section>;
}
