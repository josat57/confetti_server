/**
 * Naira exchange rates for clients paying from abroad (roadmap Phase 10).
 * Vendors are always paid in naira; a client paying in USD/GBP is charged the
 * naira amount converted at these rates. Set them in the environment and keep
 * them current (FX_NGN_PER_USD=1600, FX_NGN_PER_GBP=2050). FX_BUFFER (e.g. 0.02)
 * adds a margin for the provider's conversion costs.
 */
export const FOREIGN_CURRENCIES = ["USD", "GBP"];

const RATES = () => ({
  USD: Number(process.env.FX_NGN_PER_USD) || 1600,
  GBP: Number(process.env.FX_NGN_PER_GBP) || 2050,
});
const buffer = () => Math.min(Math.max(Number(process.env.FX_BUFFER) || 0, 0), 0.2);

/** Naira per unit of `currency` (1 for NGN) */
export const ngnPer = (currency) => (currency === "NGN" ? 1 : RATES()[currency] || null);

/** The rates shown to clients (naira per unit, buffer included) */
export const publicRates = () => Object.fromEntries(FOREIGN_CURRENCIES.map((c) => [c, Math.round(ngnPer(c) / (1 + buffer()) * 100) / 100]));

/** Kobo → minor units of `currency`, rounded up so the vendor's naira is always covered */
export const convertFromNgnMinor = (ngnMinor, currency) => {
  if (currency === "NGN") return ngnMinor;
  const rate = ngnPer(currency);
  if (!rate) return null;
  return Math.ceil((ngnMinor / rate) * (1 + buffer()));
};
