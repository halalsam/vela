type Area = 'asia' | 'europe' | 'gulf' | 'americas' | 'africa' | 'oceania';

const AREAS: Record<Area, string> = {
  asia: 'AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
  gulf: 'AE BH IL IQ JO KW LB OM PS QA SA YE',
  europe:
    'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM TR UA VA XK',
  americas:
    'AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CW DM DO EC GD GF GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PR PY SR SV SX TC TT US UY VC VG VI',
  africa:
    'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
  oceania: 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PW SB TO TV VU WF WS',
};

const areaByCode = new Map<string, Area>(
  Object.entries(AREAS).flatMap(([area, codes]) => codes.split(' ').map((code) => [code, area as Area] as const)),
);

const english = new Intl.DisplayNames(['en'], { type: 'region' });
const arabic = new Intl.DisplayNames(['ar'], { type: 'region' });

export function countryInfo(code: string): { code: string; nameEn: string; nameAr: string; area: Area } | null {
  const area = areaByCode.get(code);
  if (!area) return null;
  const nameEn = english.of(code);
  const nameAr = arabic.of(code);
  if (!nameEn || nameEn === code) return null;
  return { code, nameEn, nameAr: nameAr && nameAr !== code ? nameAr : nameEn, area };
}
