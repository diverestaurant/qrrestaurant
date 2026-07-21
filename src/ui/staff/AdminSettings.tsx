"use client";

import { useState } from "react";
import type { AdminOverviewView } from "@/contracts/view-models";
import type { SendCommand } from "@/ui/staff/AdminOperations";
import { LocalizationReadiness } from "@/ui/staff/LocalizationReadiness";

type Props = { canEditRestaurant: boolean; overview: AdminOverviewView; send: SendCommand };

export function AdminSettings({ canEditRestaurant, overview, send }: Props) {
  const restaurant = overview.settings.restaurant;
  const branch = overview.settings.branch;
  const [restaurantDraft, setRestaurantDraft] = useState(restaurant);
  const [branchDraft, setBranchDraft] = useState(branch);
  const [restaurantDirty, setRestaurantDirty] = useState(false);
  const [branchDirty, setBranchDirty] = useState(false);

  const updateRestaurant = <K extends keyof typeof restaurantDraft>(key: K, value: (typeof restaurantDraft)[K]) => {
    setRestaurantDraft((current) => ({ ...current, [key]: value }));
    setRestaurantDirty(true);
  };
  const updateBranch = <K extends keyof typeof branchDraft>(key: K, value: (typeof branchDraft)[K]) => {
    setBranchDraft((current) => ({ ...current, [key]: value }));
    setBranchDirty(true);
  };

  return <section className="rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="admin-settings">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="admin-settings" className="text-xl font-semibold">Restaurant and Branch settings</h2><p className="mt-2 text-sm leading-6 text-muted">Branch Managers maintain operating details. Legal identity and receipt branding require an Owner. Currency changes are blocked after Session activity.</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Version protected</span></div>

    <fieldset className="mt-6 rounded-2xl border bg-background p-4 disabled:opacity-70" data-admin-dirty={restaurantDirty} disabled={!canEditRestaurant}>
      <legend className="px-2 text-sm font-semibold">Restaurant profile · Owner only</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Display name<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.name} onChange={(event) => updateRestaurant("name", event.target.value)} /></label>
        <label className="text-sm">Legal name<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.legalName} onChange={(event) => updateRestaurant("legalName", event.target.value)} /></label>
        <label className="text-sm">Registration number<input autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.registrationNumber} onChange={(event) => updateRestaurant("registrationNumber", event.target.value)} /></label>
        <label className="text-sm">Tax registration number<input autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.taxRegistrationNumber} onChange={(event) => updateRestaurant("taxRegistrationNumber", event.target.value)} /></label>
        <label className="text-sm">Contact phone<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.contactPhone} onChange={(event) => updateRestaurant("contactPhone", event.target.value)} /></label>
        <label className="text-sm">Contact email<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" type="email" value={restaurantDraft.contactEmail} onChange={(event) => updateRestaurant("contactEmail", event.target.value)} /></label>
        <label className="text-sm">Default currency<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 uppercase" maxLength={3} value={restaurantDraft.defaultCurrency} onChange={(event) => updateRestaurant("defaultCurrency", event.target.value.toUpperCase())} /></label>
        <label className="text-sm">Default timezone<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={restaurantDraft.defaultTimezone} onChange={(event) => updateRestaurant("defaultTimezone", event.target.value)} /></label>
        <label className="text-sm">Brand accent<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-mono" pattern="#[0-9A-Fa-f]{6}" value={restaurantDraft.brandAccent} onChange={(event) => updateRestaurant("brandAccent", event.target.value)} /></label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">Receipt footer<textarea className="mt-1 min-h-24 w-full rounded-xl border bg-surface p-3" maxLength={500} value={restaurantDraft.receiptFooter} onChange={(event) => updateRestaurant("receiptFooter", event.target.value)} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={!restaurantDirty} onClick={() => void send("restaurant:settings", { type: "restaurant.settings.update", expectedRestaurantVersion: restaurant.version, expectedSettingsVersion: restaurant.settingsVersion, name: restaurantDraft.name, defaultCurrency: restaurantDraft.defaultCurrency, defaultTimezone: restaurantDraft.defaultTimezone, legalName: restaurantDraft.legalName, registrationNumber: restaurantDraft.registrationNumber, taxRegistrationNumber: restaurantDraft.taxRegistrationNumber, contactPhone: restaurantDraft.contactPhone, contactEmail: restaurantDraft.contactEmail, brandAccent: restaurantDraft.brandAccent, receiptFooter: restaurantDraft.receiptFooter }).then((result) => { if (result) setRestaurantDirty(false); })}>Save Restaurant profile</button><span className="text-xs text-muted">Profile v{restaurant.version} · settings v{restaurant.settingsVersion}</span></div>
    </fieldset>
    {!canEditRestaurant && <p className="mt-2 text-xs text-muted">Signed-in role can read this profile but cannot change Owner-managed legal or receipt fields.</p>}

    <fieldset className="mt-6 rounded-2xl border bg-background p-4" data-admin-dirty={branchDirty}>
      <legend className="px-2 text-sm font-semibold">Branch operations</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm sm:col-span-2">Branch name<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.name} onChange={(event) => updateBranch("name", event.target.value)} /></label>
        <label className="text-sm">Currency<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 uppercase" maxLength={3} value={branchDraft.currency} onChange={(event) => updateBranch("currency", event.target.value.toUpperCase())} /></label>
        <label className="text-sm">Business-day cutoff<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" type="time" value={branchDraft.businessDayCutoff} onChange={(event) => updateBranch("businessDayCutoff", event.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Timezone<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.timezone} onChange={(event) => updateBranch("timezone", event.target.value)} /></label>
        <label className="text-sm">Default locale<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.defaultLocale} onChange={(event) => updateBranch("defaultLocale", event.target.value as "en" | "zh" | "ms")}><option value="en">English</option><option disabled value="zh">Chinese · content pending</option><option disabled value="ms">Bahasa Melayu · content pending</option></select></label>
        <label className="text-sm">Country code<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 uppercase" maxLength={2} value={branchDraft.countryCode} onChange={(event) => updateBranch("countryCode", event.target.value.toUpperCase())} /></label>
        <label className="text-sm sm:col-span-2">Address line 1<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.addressLine1} onChange={(event) => updateBranch("addressLine1", event.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Address line 2<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.addressLine2} onChange={(event) => updateBranch("addressLine2", event.target.value)} /></label>
        <label className="text-sm">City<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.city} onChange={(event) => updateBranch("city", event.target.value)} /></label>
        <label className="text-sm">Postal code<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.postalCode} onChange={(event) => updateBranch("postalCode", event.target.value)} /></label>
        <label className="text-sm">Branch phone<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={branchDraft.contactPhone} onChange={(event) => updateBranch("contactPhone", event.target.value)} /></label>
        <label className="text-sm">Branch email<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" type="email" value={branchDraft.contactEmail} onChange={(event) => updateBranch("contactEmail", event.target.value)} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={!branchDirty} onClick={() => void send("branch:settings", { type: "branch.settings.update", expectedBranchVersion: branch.version, expectedSettingsVersion: branch.settingsVersion, name: branchDraft.name, currency: branchDraft.currency, timezone: branchDraft.timezone, businessDayCutoff: branchDraft.businessDayCutoff, defaultLocale: branchDraft.defaultLocale, addressLine1: branchDraft.addressLine1, addressLine2: branchDraft.addressLine2, city: branchDraft.city, postalCode: branchDraft.postalCode, countryCode: branchDraft.countryCode, contactPhone: branchDraft.contactPhone, contactEmail: branchDraft.contactEmail }).then((result) => { if (result) setBranchDirty(false); })}>Save Branch settings</button><span className="text-xs text-muted">Branch v{branch.version} · settings v{branch.settingsVersion}</span></div>
    </fieldset>
    <LocalizationReadiness branchName={branch.name} />
  </section>;
}
