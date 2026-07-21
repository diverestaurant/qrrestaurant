type OperatingRules = Readonly<Record<string, unknown>>;

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function localClock(timezone: string, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    return hour && minute ? `${hour}:${minute}` : null;
  } catch {
    return null;
  }
}

export function isWithinOperatingWindow(rules: OperatingRules, timezone: string, now = new Date()) {
  const availableFrom = typeof rules.availableFrom === "string" ? rules.availableFrom : null;
  const availableUntil = typeof rules.availableUntil === "string" ? rules.availableUntil : null;
  if (availableFrom === null && availableUntil === null) return true;
  if (!availableFrom || !availableUntil || !TIME_PATTERN.test(availableFrom) || !TIME_PATTERN.test(availableUntil)) return false;
  if (availableFrom === availableUntil) return true;

  const current = localClock(timezone, now);
  if (!current) return false;
  return availableFrom < availableUntil
    ? current >= availableFrom && current < availableUntil
    : current >= availableFrom || current < availableUntil;
}
