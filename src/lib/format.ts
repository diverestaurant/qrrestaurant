export function formatMoney(minorUnits: number, currency = "MYR", locale = "en-MY") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minorUnits / 100);
}

export function formatElapsed(minutes: number) {
  return `${minutes} min`;
}
