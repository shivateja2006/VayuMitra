import { INDIAN_CITY_PRESETS, type IndianCityPreset } from '../data/indianCities.ts';
import type {
  AqiAtmosphere,
  AqiClassification,
  AreaProbeReading,
  DangerousLocationAlert,
  HouseholdProfile,
  ImpactSummary,
  IndianAqiBand,
  PlanActionItem,
  TailoredPlanResponse,
  ThemeMode,
} from '../types/airQuality.ts';

/**
 * Computes India CPCB National Air Quality Index (NAQI) sub-index from PM2.5 (µg/m³).
 * Official CPCB breakpoints:
 *   0-30 -> 0-50 (Good)
 *   31-60 -> 51-100 (Satisfactory)
 *   61-90 -> 101-200 (Moderate)
 *   91-120 -> 201-300 (Poor)
 *   121-250 -> 301-400 (Very Poor)
 *   >250 -> 401-500 (Severe)
 */
export function computeIndianNaqiFromPm25(pm25: number): number {
  const c = Math.max(0, pm25);
  if (c <= 30) return Math.round((c / 30) * 50);
  if (c <= 60) return Math.round(51 + ((c - 31) / 29) * 49);
  if (c <= 90) return Math.round(101 + ((c - 61) / 29) * 99);
  if (c <= 120) return Math.round(201 + ((c - 91) / 29) * 99);
  if (c <= 250) return Math.round(301 + ((c - 121) / 129) * 99);
  return Math.min(500, Math.round(401 + ((c - 251) / 150) * 99));
}

export function classifyIndianAqi(aqi: number): AqiClassification {
  const safeAqi = Math.max(0, Math.round(aqi));

  if (safeAqi <= 50) {
    return {
      band: 'Good',
      summary: 'Minimal respiratory impact across all age groups.',
      outdoorAdvice: 'Normal outdoor activity and cross-ventilation are safe.',
      bestWindow: 'All day (06:00 – 21:00)',
      accentHex: '#4ADE80',
      markerHex: '#15803D',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/75',
      badgeTextClass: 'text-emerald-800 dark:text-emerald-300',
      borderClass: 'border-emerald-200 dark:border-emerald-700/60',
    };
  }
  if (safeAqi <= 100) {
    return {
      band: 'Satisfactory',
      summary: 'Minor breathing discomfort possible for highly sensitive people.',
      outdoorAdvice: 'Safe for routines; asthmatic residents should carry rescue inhalers.',
      bestWindow: '08:00 – 19:00',
      accentHex: '#A3E635',
      markerHex: '#4D7C0F',
      textClass: 'text-lime-700 dark:text-lime-400',
      badgeBgClass: 'bg-lime-50 dark:bg-lime-950/75',
      badgeTextClass: 'text-lime-800 dark:text-lime-300',
      borderClass: 'border-lime-200 dark:border-lime-700/60',
    };
  }
  if (safeAqi <= 200) {
    return {
      band: 'Moderate',
      summary: 'Breathing discomfort for people with asthma, lung or heart conditions, children, and older adults.',
      outdoorAdvice: 'Shift vigorous exercise indoors or to midday sun (12:30 – 16:00).',
      bestWindow: '12:30 – 16:00 (Peak sunlight mixing)',
      accentHex: '#FBBF24',
      markerHex: '#B45309',
      textClass: 'text-amber-700 dark:text-amber-400',
      badgeBgClass: 'bg-amber-50 dark:bg-amber-950/75',
      badgeTextClass: 'text-amber-800 dark:text-amber-300',
      borderClass: 'border-amber-200 dark:border-amber-700/60',
    };
  }
  if (safeAqi <= 300) {
    return {
      band: 'Poor',
      summary: 'Breathing discomfort for most residents on prolonged exposure; winter smog layer traps PM2.5.',
      outdoorAdvice: 'Wear N95 masks on commutes; keep morning/evening windows sealed.',
      bestWindow: '13:00 – 15:30 (Briefest dispersion window)',
      accentHex: '#FB923C',
      markerHex: '#EA580C',
      textClass: 'text-orange-700 dark:text-orange-400',
      badgeBgClass: 'bg-orange-50 dark:bg-orange-950/75',
      badgeTextClass: 'text-orange-800 dark:text-orange-300',
      borderClass: 'border-orange-200 dark:border-orange-600/60',
    };
  }
  if (safeAqi <= 400) {
    return {
      band: 'Very Poor',
      summary: 'Respiratory illness risk on prolonged exposure; severe winter inversion keeps particulates at street level.',
      outdoorAdvice: 'Avoid outdoor morning walks and schoolyard sports; run indoor HEPA/DIY filtration.',
      bestWindow: '13:30 – 15:00 only if essential',
      accentHex: '#F87171',
      markerHex: '#DC2626',
      textClass: 'text-red-700 dark:text-red-400',
      badgeBgClass: 'bg-red-50 dark:bg-red-950/80',
      badgeTextClass: 'text-red-800 dark:text-red-300',
      borderClass: 'border-red-200 dark:border-red-600/60',
    };
  }
  return {
    band: 'Severe',
    summary: 'Health alert: impacts healthy adults and causes serious respiratory strain for children and seniors.',
    outdoorAdvice: 'Stay indoors with sealed gaps and wet-mopped floors; N95 mandatory outside.',
    bestWindow: 'Avoid outdoor exertion all day',
    accentHex: '#FB7185',
    markerHex: '#BE123C',
    textClass: 'text-rose-800 dark:text-rose-400',
    badgeBgClass: 'bg-rose-100 dark:bg-rose-950/85',
    badgeTextClass: 'text-rose-900 dark:text-rose-200',
    borderClass: 'border-rose-300 dark:border-rose-500/70',
  };
}

export function formatPollutantUnit(units: string): string {
  switch (units) {
    case 'MICROGRAMS_PER_CUBIC_METER':
      return 'µg/m³';
    case 'PARTS_PER_BILLION':
      return 'ppb';
    case 'PARTS_PER_MILLION':
      return 'ppm';
    default:
      return units.toLowerCase().replace(/_/g, ' ');
  }
}

export function getPollutantSafeLimit(code: string): string {
  switch (code.toLowerCase()) {
    case 'pm25':
      return 'CPCB 24h limit: 60 µg/m³';
    case 'pm10':
      return 'CPCB 24h limit: 100 µg/m³';
    case 'no2':
      return 'CPCB 24h limit: 80 µg/m³';
    case 'so2':
      return 'CPCB 24h limit: 80 µg/m³';
    case 'o3':
      return 'CPCB 8h limit: 100 µg/m³';
    case 'co':
      return 'CPCB 8h limit: 2,000 µg/m³';
    default:
      return 'CPCB guideline monitored';
  }
}

export function getCollectiveImpactTier(
  score: number
): ImpactSummary['collectiveImpactTier'] {
  if (score <= 0) return 'Not Started';
  if (score < 30) return 'Starter';
  if (score < 60) return 'Building Momentum';
  if (score < 90) return 'High Impact';
  return 'Maximum Protection';
}

function getActionImpactWeight(item: PlanActionItem): number {
  return Math.max(
    1,
    item.exposureReductionPct +
      Math.max(0, item.weeklyCo2SavedKg) * 2.5 +
      Math.max(0, item.weeklyPm25AvoidedGrams) * 2
  );
}

export function calculateChoiceImpact(
  actions: PlanActionItem[],
  adoptedIds: string[]
): ImpactSummary {
  const adoptedSet = new Set(adoptedIds);
  const selected = actions.filter((a) => adoptedSet.has(a.id));

  if (selected.length === 0 || actions.length === 0) {
    return {
      adoptedCount: 0,
      totalCount: actions.length,
      collectiveImpactScore: 0,
      collectiveImpactTier: 'Not Started',
      personalExposureReductionPct: 0,
      weeklyCo2SavedKg: 0,
      weeklyPm25AvoidedGrams: 0,
    };
  }

  // Compound diminishing-returns model so combined exposure reduction stays physically bounded < 92%
  let remainingExposure = 1;
  let co2Sum = 0;
  let pm25Sum = 0;
  let selectedWeight = 0;

  for (const item of selected) {
    const pct = Math.min(60, Math.max(0, item.exposureReductionPct)) / 100;
    remainingExposure *= 1 - pct;
    co2Sum += Math.max(0, item.weeklyCo2SavedKg);
    pm25Sum += Math.max(0, item.weeklyPm25AvoidedGrams);
    selectedWeight += getActionImpactWeight(item);
  }

  const totalWeight = actions.reduce((acc, item) => acc + getActionImpactWeight(item), 0);
  const countRatio = selected.length / actions.length;
  const weightRatio = totalWeight > 0 ? selectedWeight / totalWeight : countRatio;
  const collectiveImpactScore =
    selected.length === actions.length
      ? 100
      : Math.min(99, Math.max(1, Math.round((countRatio * 0.6 + weightRatio * 0.4) * 100)));

  const combinedReduction = Math.min(92, Math.round((1 - remainingExposure) * 100));

  return {
    adoptedCount: selected.length,
    totalCount: actions.length,
    collectiveImpactScore,
    collectiveImpactTier: getCollectiveImpactTier(collectiveImpactScore),
    personalExposureReductionPct: combinedReduction,
    weeklyCo2SavedKg: Number(co2Sum.toFixed(1)),
    weeklyPm25AvoidedGrams: Number(pm25Sum.toFixed(1)),
  };
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestCityPreset(lat: number, lng: number): IndianCityPreset | null {
  let best: IndianCityPreset | null = null;
  let bestDist = Infinity;
  for (const preset of INDIAN_CITY_PRESETS) {
    const dist = haversineDistanceKm(lat, lng, preset.lat, preset.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = preset;
    }
  }
  return bestDist <= 65 ? best : null;
}

export function buildAreaBreakdown(params: {
  centerLat: number;
  centerLng: number;
  city: string;
  area: string;
  primaryAqi: number;
  dominantPollutant: string;
  pm25?: number;
  isLivePrimary: boolean;
}): AreaProbeReading[] {
  const { centerLat, centerLng, city, area, primaryAqi, dominantPollutant, pm25, isLivePrimary } =
    params;

  const preset = findNearestCityPreset(centerLat, centerLng);
  if (preset) {
    return preset.areas.map((zone, index) => {
      const distKm = haversineDistanceKm(centerLat, centerLng, zone.lat, zone.lng);
      const isPrimary = distKm < 1.8 || (index === 0 && !preset.areas.some((z) => haversineDistanceKm(centerLat, centerLng, z.lat, z.lng) < 1.8));
      const computedAqi = isPrimary
        ? Math.round(primaryAqi)
        : Math.min(500, Math.max(25, Math.round(primaryAqi * zone.dispersionFactor)));
      const cls = classifyIndianAqi(computedAqi);

      return {
        id: zone.id,
        areaName: isPrimary && area ? area : zone.areaName,
        zoneType: zone.zoneType,
        city: preset.city,
        lat: isPrimary ? centerLat : zone.lat,
        lng: isPrimary ? centerLng : zone.lng,
        aqi: computedAqi,
        band: cls.band as IndianAqiBand,
        dominantPollutant: dominantPollutant.toUpperCase(),
        pm25: pm25 !== undefined ? Number((pm25 * (isPrimary ? 1 : zone.dispersionFactor)).toFixed(1)) : undefined,
        isPrimary,
        isLive: isPrimary && isLivePrimary,
        healthNote: cls.outdoorAdvice,
      };
    });
  }

  // Generic cardinal neighborhood layout around any searched Indian town or pin
  const centralLabel =
    area && area.toLowerCase() !== city.toLowerCase() ? area : `${city} Central`;
  const offsets: Array<{
    suffix: string;
    zoneType: AreaProbeReading['zoneType'];
    dLat: number;
    dLng: number;
    factor: number;
    isPrimary?: boolean;
  }> = [
    { suffix: centralLabel, zoneType: 'Commercial Core', dLat: 0, dLng: 0, factor: 1.0, isPrimary: true },
    { suffix: `${city} Transit Corridor`, zoneType: 'Transit & Industrial', dLat: 0.028, dLng: 0.032, factor: 1.18 },
    { suffix: `${city} Residential South`, zoneType: 'Residential', dLat: -0.025, dLng: -0.02, factor: 0.92 },
    { suffix: `${city} Green Belt`, zoneType: 'Green Belt', dLat: -0.018, dLng: 0.034, factor: 0.78 },
  ];

  return offsets.map((o, idx) => {
    const computedAqi = o.isPrimary
      ? Math.round(primaryAqi)
      : Math.min(500, Math.max(20, Math.round(primaryAqi * o.factor)));
    const cls = classifyIndianAqi(computedAqi);
    return {
      id: `area-${idx}-${city.toLowerCase().replace(/\s+/g, '-')}`,
      areaName: o.suffix,
      zoneType: o.zoneType,
      city,
      lat: Number((centerLat + o.dLat).toFixed(5)),
      lng: Number((centerLng + o.dLng).toFixed(5)),
      aqi: computedAqi,
      band: cls.band as IndianAqiBand,
      dominantPollutant: dominantPollutant.toUpperCase(),
      pm25: pm25 !== undefined ? Number((pm25 * (o.isPrimary ? 1 : o.factor)).toFixed(1)) : undefined,
      isPrimary: Boolean(o.isPrimary),
      isLive: Boolean(o.isPrimary) && isLivePrimary,
      healthNote: cls.outdoorAdvice,
    };
  });
}

export function buildBaselineTailoredPlan(
  city: string,
  area: string,
  aqi: number,
  profile: HouseholdProfile
): TailoredPlanResponse {
  const cls = classifyIndianAqi(aqi);
  const hasSensitive = profile.sensitiveGroups.length > 0;
  const isDriving = profile.commuteMode === 'car_two_wheeler';
  const isGroundFloor = profile.homeType === 'ground_floor_roadside';

  const actions: PlanActionItem[] = [
    {
      id: 'routine-midday-shift',
      category: 'routine',
      title: 'Shift outdoor errands & walks to the 13:00–15:30 solar mixing window',
      timeWindow: '13:00 – 15:30 IST',
      description: `Winter temperature inversion traps cold exhaust and dust near ground level between 06:00–09:30 and after 18:30 in ${city}. Midday sunlight lifts the boundary layer and dilutes PM2.5.`,
      directImpactExplanation: `Moving a 40-minute morning outing to early afternoon cuts peak inhaled PM2.5 by ~28%${hasSensitive ? ' — especially critical for children and elderly lungs' : ''}.`,
      exposureReductionPct: 28,
      weeklyCo2SavedKg: 0,
      weeklyPm25AvoidedGrams: 0.4,
      costLevel: 'Free',
    },
    {
      id: 'routine-commute-swap',
      category: 'routine',
      title: isDriving
        ? 'Swap 2 weekly car/two-wheeler trips for Metro, bus, or carpool'
        : 'Keep masks fitted on arterial junctions & avoid idling near intersections',
      timeWindow: '08:30 – 10:30 / 17:30 – 20:00 IST',
      description: isDriving
        ? `Cold-start winter engines emit high unburnt hydrocarbons and NO2 in stop-and-go ${area} traffic. Sharing rides or taking rail removes tailpipe emissions at breathing height.`
        : `Standing at signalised corridors exposes commuters to 2–3× ambient PM2.5. Stepping 15m back from curb lanes and wearing an N95 mask sharply limits black-carbon intake.`,
      directImpactExplanation: isDriving
        ? 'Eliminating 40 km of solo winter driving per week avoids 7.4 kg CO2e and prevents tailpipe PM2.5 directly along neighborhood roads.'
        : 'Wearing a snug N95 mask during peak transit windows filters ≥90% of street-level PM2.5 particles.',
      exposureReductionPct: isDriving ? 16 : 32,
      weeklyCo2SavedKg: isDriving ? 7.4 : 1.5,
      weeklyPm25AvoidedGrams: isDriving ? 4.8 : 0.9,
      costLevel: 'Low Cost',
    },
    {
      id: 'indoor-wet-mop-seal',
      category: 'indoor_hack',
      title: isGroundFloor
        ? 'Wet-mop floors daily & seal roadside balcony/door gaps with draft strips'
        : 'Replace dry jhadu sweeping with wet mopping & run kitchen exhaust during tadka',
      timeWindow: 'Morning & Meal Prep',
      description:
        'Dry sweeping resuspends settled fine dust back into indoor air for hours. High-heat tadka/frying spikes indoor PM2.5 above 300 µg/m³ unless vented outside immediately.',
      directImpactExplanation:
        'Wet mopping + active exhaust ventilation prevents indoor particle resuspension and cuts household indoor PM2.5 spikes by ~24%.',
      exposureReductionPct: 24,
      weeklyCo2SavedKg: 0.4,
      weeklyPm25AvoidedGrams: 1.8,
      costLevel: 'Free',
    },
    {
      id: 'indoor-diy-hepa',
      category: 'indoor_hack',
      title: 'Run a bedroom HEPA purifier or DIY box-fan MERV-13 / HEPA filter at night',
      timeWindow: '21:00 – 07:00 IST',
      description:
        'Sealing one sleeping room and taping a MERV-13 / HEPA replacement cartridge onto a standard box or exhaust fan cleans bedroom air continuously for ~8 hours of recovery sleep.',
      directImpactExplanation:
        'Continuous bedroom filtration lowers overnight PM2.5 exposure by 35–45%, reducing morning throat irritation and inflammatory load.',
      exposureReductionPct: 38,
      weeklyCo2SavedKg: 0,
      weeklyPm25AvoidedGrams: 0.6,
      costLevel: 'Low Cost',
    },
    {
      id: 'alt-zero-burn',
      category: 'sustainable_alt',
      title:
        profile.cookingFuel === 'mixed_biomass'
          ? 'Transition smoky heating/cooking to electric induction or clean LPG'
          : 'Ban winter dry-leaf & waste burning in your RWA and compost wet waste',
      timeWindow: 'Weekly Community Habit',
      description:
        profile.cookingFuel === 'mixed_biomass'
          ? 'Indoor wood, coal, or cow-dung combustion produces dense PM2.5 and CO plumes inside poorly ventilated winter kitchens.'
          : 'A single neighborhood pile of burning dry leaves releases as much PM2.5 in an hour as hundreds of vehicles idling.',
      directImpactExplanation:
        profile.cookingFuel === 'mixed_biomass'
          ? 'Switching to induction/clean LPG cuts kitchen PM2.5 emissions by >75% and saves ~12 kg CO2e weekly.'
          : 'Composting 5 kg of garden/kitchen waste weekly prevents ~9.5 g of toxic open-burn PM2.5 and 5.2 kg CO2e from blanketing your street.',
      exposureReductionPct: profile.cookingFuel === 'mixed_biomass' ? 40 : 14,
      weeklyCo2SavedKg: profile.cookingFuel === 'mixed_biomass' ? 12.0 : 5.2,
      weeklyPm25AvoidedGrams: profile.cookingFuel === 'mixed_biomass' ? 14.5 : 9.5,
      costLevel: profile.cookingFuel === 'mixed_biomass' ? 'Moderate' : 'Free',
    },
    {
      id: 'alt-solar-electric',
      category: 'sustainable_alt',
      title: 'Use electric Kettle/Induction & urge apartment society to ban diesel DG idling',
      timeWindow: 'Ongoing Home & RWA Choice',
      description:
        'Battery/inverter backups and clean electric cooking avoid neighborhood NO2 and black soot emissions during winter evening grid peaks.',
      directImpactExplanation:
        'Cutting fossil backup reliance and shifting one daily boil/meal to induction avoids 4.1 kg CO2e and local soot every week.',
      exposureReductionPct: 12,
      weeklyCo2SavedKg: 4.1,
      weeklyPm25AvoidedGrams: 3.2,
      costLevel: 'Low Cost',
    },
  ];

  return {
    summaryHeadline: `${formatLocationLabel(area, city)} is in ${cls.band} air quality (NAQI ${Math.round(aqi)})`,
    whyThisMattersNow: `${cls.summary} ${cls.outdoorAdvice}`,
    bestOutdoorWindow: cls.bestWindow,
    actions,
    communityTip: `Share your RWA's zero-leaf-burning pledge and coordinate shared school/office rides across ${formatLocationLabel(area, city)} to cut street-level morning spikes.`,
    generatedBy: 'baseline-guide',
  };
}

export function formatLocationLabel(area: string, city: string, separator = ', '): string {
  const cleanArea = area.trim();
  const cleanCity = city.trim();
  if (!cleanArea) return cleanCity;
  if (!cleanCity) return cleanArea;
  if (cleanArea.toLowerCase() === cleanCity.toLowerCase()) return cleanCity;
  return `${cleanArea}${separator}${cleanCity}`;
}

export function getAqiAtmosphere(aqi: number): AqiAtmosphere {
  const safe = Math.max(0, Math.round(aqi));
  if (safe <= 100) return 'good';
  if (safe <= 200) return 'moderate';
  return 'bad';
}

export function resolveEffectiveTheme(
  themeMode: ThemeMode,
  aqi: number
): {
  isDark: boolean;
  atmosphere: AqiAtmosphere;
  label: string;
} {
  const atmosphere = getAqiAtmosphere(aqi);
  const isDark =
    themeMode === 'dark' || (themeMode === 'auto' && atmosphere === 'bad');

  const label =
    atmosphere === 'good'
      ? 'Good Air Theme'
      : atmosphere === 'moderate'
        ? 'Caution Haze Theme'
        : 'Bad Air Alert Theme';

  return { isDark, atmosphere, label };
}

export function sortDangerousLocations(
  alerts: DangerousLocationAlert[]
): DangerousLocationAlert[] {
  const seen = new Set<string>();
  const filtered: DangerousLocationAlert[] = [];

  for (const item of [...alerts].sort((a, b) => b.aqi - a.aqi)) {
    if (item.aqi <= 200) continue;
    const key = `${item.areaName.toLowerCase()}|${item.city.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(item);
  }

  return filtered;
}
