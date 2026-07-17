/** Locale-aware number / currency / date / percent formatting. */
const localeMap: Record<string, string> = { en: 'en-US', ar: 'ar-LB', fr: 'fr-FR' };

export const fmtNumber = (v: number | null | undefined, locale = 'en', digits = 0) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat(localeMap[locale] ?? locale, {
        maximumFractionDigits: digits,
      }).format(v);

export const fmtCurrency = (v: number | null | undefined, locale = 'en', currency = 'USD') =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat(localeMap[locale] ?? locale, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(v);

export const fmtPercent = (v: number | null | undefined, locale = 'en', digits = 0) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat(localeMap[locale] ?? locale, {
        style: 'percent', maximumFractionDigits: digits,
      }).format(v);

export const fmtDate = (v: string | Date | null | undefined, locale = 'en') =>
  !v
    ? '—'
    : new Intl.DateTimeFormat(localeMap[locale] ?? locale, {
        year: 'numeric', month: 'short', day: 'numeric',
      }).format(new Date(v));

export const fmtDateTime = (v: string | Date | null | undefined, locale = 'en') =>
  !v
    ? '—'
    : new Intl.DateTimeFormat(localeMap[locale] ?? locale, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(v));
