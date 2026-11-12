import type { Money } from '../contracts';

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  '₽': 'RUB',
  A$: 'AUD',
  C$: 'CAD',
  US$: 'USD',
};

const CURRENCY_ALIASES: Record<string, string> = {
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  jpy: 'JPY',
  cad: 'CAD',
  aud: 'AUD',
  inr: 'INR',
  dollar: 'USD',
  dollars: 'USD',
  euro: 'EUR',
  euros: 'EUR',
  pound: 'GBP',
  pounds: 'GBP',
};

/**
 * Parses a human price string into Money. Returns null when amount or currency cannot be
 * determined — never invents a currency.
 */
export function parseMoney(raw: string, fallbackCurrency?: string | null): Money | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let currency: string | undefined;
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (trimmed.includes(symbol)) {
      currency = code;
      break;
    }
  }

  const currencyMatch = /\b([A-Za-z]{3})\b/.exec(trimmed);
  if (!currency && currencyMatch?.[1]) {
    const alias = CURRENCY_ALIASES[currencyMatch[1].toLowerCase()];
    currency = alias ?? currencyMatch[1].toUpperCase();
  }

  if (!currency && fallbackCurrency) {
    const alias = CURRENCY_ALIASES[fallbackCurrency.toLowerCase()];
    currency =
      alias ?? (fallbackCurrency.length === 3 ? fallbackCurrency.toUpperCase() : undefined);
  }

  const amountMatch = /-?\d+(?:\.\d+)?/.exec(trimmed.replace(/,/g, ''));
  const amountText = amountMatch?.[0];
  if (!amountText || currency?.length !== 3) return null;
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { amount, currency };
}

export function formatMoney(money: Money): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  } catch {
    return `${money.currency} ${money.amount}`;
  }
}
