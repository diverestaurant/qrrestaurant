import { AppError } from "@/lib/errors";

export function parseMajorAmountToMinor(input: string, fractionDigits = 2) {
  const value = input.trim();
  const match = new RegExp(`^(\\d{1,9})(?:\\.(\\d{1,${fractionDigits}}))?$`).exec(value);
  if (!match) throw new AppError("VALIDATION_ERROR", `Enter a valid amount with up to ${fractionDigits} decimal places.`);
  const scale = 10 ** fractionDigits;
  const wholeMinor = Number(match[1]) * scale;
  const fractionMinor = Number((match[2] ?? "").padEnd(fractionDigits, "0"));
  const result = wholeMinor + fractionMinor;
  if (!Number.isSafeInteger(result)) throw new AppError("VALIDATION_ERROR", "The amount is outside the supported range.");
  return result;
}

export function formatMinorForAmountInput(minor: number, fractionDigits = 2) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new AppError("VALIDATION_ERROR", "The amount is outside the supported range.");
  const scale = 10 ** fractionDigits;
  return `${Math.floor(minor / scale)}.${String(minor % scale).padStart(fractionDigits, "0")}`;
}
