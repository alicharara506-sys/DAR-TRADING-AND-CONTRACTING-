import en from './en.json';
import ar from './ar.json';
import fr from './fr.json';

export const LOCALES = ['en', 'ar', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const RTL_LOCALES: Locale[] = ['ar'];

const dictionaries = { en, ar, fr } as const;
export type Dictionary = typeof en;

export function getDictionary(locale: string): Dictionary {
  return (dictionaries as Record<string, Dictionary>)[locale] ?? en;
}

export const isRtl = (locale: string) => RTL_LOCALES.includes(locale as Locale);

/** Dot-path translate helper: t(dict, 'nav.dashboard') */
export function translate(dict: Dictionary, path: string): string {
  const value = path.split('.').reduce<any>((acc, key) => acc?.[key], dict);
  return typeof value === 'string' ? value : path;
}
