const JOIN_CODE_LENGTH = 6;

export function normalizeJoinCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, JOIN_CODE_LENGTH);
}

export function isJoinCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function isGrantLive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function generateJoinCode(random = Math.random): string {
  const max = 10 ** JOIN_CODE_LENGTH;
  return Math.floor(random() * max)
    .toString()
    .padStart(JOIN_CODE_LENGTH, "0");
}
