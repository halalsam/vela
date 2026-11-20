import type { Country, Localized } from '@vela/api';

export type CountryGroup = { letter: string; data: Country[][] };

function sortKey(name: string, language: 'en' | 'ar') {
  return language === 'ar' ? name.replace(/^ال/, '') : name;
}

export function groupCountries(countries: readonly Country[], localized: (value: Localized) => string, language: 'en' | 'ar'): CountryGroup[] {
  const sorted = [...countries].sort((a, b) =>
    sortKey(localized(a.name), language).localeCompare(sortKey(localized(b.name), language), language),
  );
  const groups = new Map<string, Country[]>();
  for (const country of sorted) {
    const letter = sortKey(localized(country.name), language).charAt(0).toLocaleUpperCase(language);
    groups.set(letter, [...(groups.get(letter) ?? []), country]);
  }
  return [...groups.entries()].map(([letter, items]) => ({ letter, data: [items] }));
}

export function matches(query: string, ...values: string[]) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return values.some((value) => value.toLocaleLowerCase().includes(needle));
}
