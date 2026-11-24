const ARABIC: Record<string, string> = {
  'north america': 'أمريكا الشمالية',
  'south america': 'أمريكا الجنوبية',
  'latin america': 'أمريكا اللاتينية',
  'central america': 'أمريكا الوسطى',
  americas: 'الأمريكتان',
  caribbean: 'الكاريبي',
  africa: 'أفريقيا',
  'north africa': 'شمال أفريقيا',
  'middle east': 'الشرق الأوسط',
  'middle east & north africa': 'الشرق الأوسط وشمال أفريقيا',
  mena: 'الشرق الأوسط وشمال أفريقيا',
  gcc: 'دول الخليج',
  gulf: 'الخليج',
  oceania: 'أوقيانوسيا',
  'australia & new zealand': 'أستراليا ونيوزيلندا',
  balkans: 'البلقان',
  'central asia': 'آسيا الوسطى',
  'southeast asia': 'جنوب شرق آسيا',
  'south asia': 'جنوب آسيا',
  'east asia': 'شرق آسيا',
  asia: 'آسيا',
  'asia pacific': 'آسيا والمحيط الهادئ',
  europe: 'أوروبا',
  'eastern europe': 'أوروبا الشرقية',
  scandinavia: 'إسكندنافيا',
  nordics: 'دول الشمال الأوروبي',
  'china, hong kong & macau': 'الصين وهونغ كونغ وماكاو',
  'china & hong kong & macau': 'الصين وهونغ كونغ وماكاو',
  'china hong kong macau': 'الصين وهونغ كونغ وماكاو',
  'usa & canada': 'الولايات المتحدة وكندا',
  'us & canada': 'الولايات المتحدة وكندا',
  global: 'عالمي',
  world: 'العالم',
};

export function cleanRegionName(name: string): string {
  return name.replace(/[\s-]*\d+\s*$/, '').replace(/\s+/g, ' ').trim() || name.trim();
}

export function regionNames(name: string): { nameEn: string; nameAr: string } {
  const nameEn = cleanRegionName(name);
  const key = nameEn.toLowerCase().replace(/\s+and\s+/g, ' & ');
  return { nameEn, nameAr: ARABIC[key] ?? ARABIC[key.replace(/[^a-z& ]/g, '').trim()] ?? nameEn };
}
