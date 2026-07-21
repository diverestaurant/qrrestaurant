export type CurrencyCode = "MYR" | "USD" | "SGD" | (string & {});
export type Money = { minor: number; currency: CurrencyCode };

function assertCurrency(left: Money, right: Money) {
  if (left.currency !== right.currency) throw new Error(`Currency mismatch: ${left.currency} vs ${right.currency}`);
}

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Money must be a non-negative safe integer minor unit");
  return { minor, currency };
}

export function addMoney(left: Money, right: Money): Money { assertCurrency(left, right); return money(left.minor + right.minor, left.currency); }
export function subtractMoney(left: Money, right: Money): Money { assertCurrency(left, right); return money(left.minor - right.minor, left.currency); }
export function multiplyMoney(unit: Money, quantity: number): Money { if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Quantity must be a non-negative integer"); return money(unit.minor * quantity, unit.currency); }

export type PricingLine = { unit: Money; quantity: number; taxEligible?: boolean; serviceEligible?: boolean };
export type PricingRules = { taxBasisPoints: number; serviceBasisPoints: number; taxInclusive: boolean; serviceInclusive: boolean };
export type PricingTotals = { subtotal: Money; tax: Money; service: Money; grandTotal: Money };

function basisPoints(amount: Money, rate: number) { if (!Number.isSafeInteger(rate) || rate < 0) throw new Error("Rate must be non-negative integer basis points"); return money(Math.round((amount.minor * rate) / 10_000), amount.currency); }

export function calculatePricing(lines: PricingLine[], rules: PricingRules): PricingTotals {
  if (lines.length === 0) throw new Error("At least one pricing line is required");
  const currency = lines[0].unit.currency;
  const subtotal = lines.reduce((sum, line) => addMoney(sum, multiplyMoney(line.unit, line.quantity)), money(0, currency));
  const taxable = lines.filter((line) => line.taxEligible !== false).reduce((sum, line) => addMoney(sum, multiplyMoney(line.unit, line.quantity)), money(0, currency));
  const serviceable = lines.filter((line) => line.serviceEligible !== false).reduce((sum, line) => addMoney(sum, multiplyMoney(line.unit, line.quantity)), money(0, currency));
  const tax = rules.taxInclusive ? money(0, currency) : basisPoints(taxable, rules.taxBasisPoints);
  const service = rules.serviceInclusive ? money(0, currency) : basisPoints(serviceable, rules.serviceBasisPoints);
  return { subtotal, tax, service, grandTotal: addMoney(addMoney(subtotal, tax), service) };
}
