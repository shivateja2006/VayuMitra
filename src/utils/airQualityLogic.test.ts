import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAreaBreakdown,
  calculateChoiceImpact,
  classifyIndianAqi,
  computeIndianNaqiFromPm25,
  formatLocationLabel,
  formatPollutantUnit,
  getAqiAtmosphere,
  resolveEffectiveTheme,
  sortDangerousLocations,
} from './airQualityLogic.ts';
import type { PlanActionItem } from '../types/airQuality.ts';

test('formatLocationLabel avoids duplicate city-area names', () => {
  assert.equal(formatLocationLabel('Pune', 'Pune'), 'Pune');
  assert.equal(formatLocationLabel('Connaught Place', 'New Delhi'), 'Connaught Place, New Delhi');
  assert.equal(formatLocationLabel('Rohini', 'New Delhi', ' · '), 'Rohini · New Delhi');
});

test('computeIndianNaqiFromPm25 maps CPCB breakpoints accurately', () => {
  assert.equal(computeIndianNaqiFromPm25(15), 25); // Good
  assert.equal(computeIndianNaqiFromPm25(30), 50); // Good upper bound
  assert.equal(computeIndianNaqiFromPm25(60), 100); // Satisfactory upper bound
  assert.equal(computeIndianNaqiFromPm25(90), 200); // Moderate upper bound
  assert.equal(computeIndianNaqiFromPm25(120), 300); // Poor upper bound
  assert.equal(computeIndianNaqiFromPm25(250), 400); // Very Poor upper bound
  assert.equal(computeIndianNaqiFromPm25(420) > 400, true); // Severe
});

test('classifyIndianAqi returns correct CPCB bands and outdoor windows', () => {
  for (const val of [42, 88, 165, 245, 348, 435]) {
    const cls = classifyIndianAqi(val);
    assert.equal(Boolean(cls.textClass), true);
    assert.equal(Boolean(cls.markerHex), true);
  }
  assert.equal(classifyIndianAqi(42).band, 'Good');
  assert.equal(classifyIndianAqi(88).band, 'Satisfactory');
  assert.equal(classifyIndianAqi(165).band, 'Moderate');
  assert.equal(classifyIndianAqi(245).band, 'Poor');
  assert.equal(classifyIndianAqi(348).band, 'Very Poor');
  assert.equal(classifyIndianAqi(435).band, 'Severe');
});

test('calculateChoiceImpact computes diminishing exposure reduction and exact weekly savings', () => {
  const actions: PlanActionItem[] = [
    {
      id: 'a1',
      category: 'routine',
      title: 'Midday shift',
      timeWindow: '13:00',
      description: 'Desc',
      directImpactExplanation: 'Impact',
      exposureReductionPct: 30,
      weeklyCo2SavedKg: 5.5,
      weeklyPm25AvoidedGrams: 4.2,
      costLevel: 'Free',
    },
    {
      id: 'a2',
      category: 'indoor_hack',
      title: 'HEPA sleep',
      timeWindow: '22:00',
      description: 'Desc',
      directImpactExplanation: 'Impact',
      exposureReductionPct: 40,
      weeklyCo2SavedKg: 2.0,
      weeklyPm25AvoidedGrams: 1.8,
      costLevel: 'Low Cost',
    },
  ];

  const empty = calculateChoiceImpact(actions, []);
  assert.equal(empty.adoptedCount, 0);
  assert.equal(empty.personalExposureReductionPct, 0);
  assert.equal(empty.collectiveImpactScore, 0);
  assert.equal(empty.collectiveImpactTier, 'Not Started');

  const partial = calculateChoiceImpact(actions, ['a1']);
  assert.equal(partial.adoptedCount, 1);
  assert.equal(partial.collectiveImpactScore > 0 && partial.collectiveImpactScore < 100, true);

  const both = calculateChoiceImpact(actions, ['a1', 'a2']);
  assert.equal(both.adoptedCount, 2);
  // 1 - (0.7 * 0.6) = 0.58 => 58%
  assert.equal(both.personalExposureReductionPct, 58);
  assert.equal(both.weeklyCo2SavedKg, 7.5);
  assert.equal(both.weeklyPm25AvoidedGrams, 6.0);
  assert.equal(both.collectiveImpactScore, 100);
  assert.equal(both.collectiveImpactTier, 'Maximum Protection');
  assert.equal(both.collectiveImpactScore > partial.collectiveImpactScore, true);
});

test('buildAreaBreakdown produces multi-area probes with a single primary area', () => {
  const areas = buildAreaBreakdown({
    centerLat: 28.6315,
    centerLng: 77.2167,
    city: 'New Delhi',
    area: 'Connaught Place',
    primaryAqi: 340,
    dominantPollutant: 'pm25',
    pm25: 170,
    isLivePrimary: true,
  });

  assert.equal(areas.length >= 4, true);
  assert.equal(areas.filter((a) => a.isPrimary).length, 1);
  const primary = areas.find((a) => a.isPrimary);
  assert.equal(primary?.aqi, 340);
  assert.equal(primary?.isLive, true);
});

test('formatPollutantUnit normalizes Google Air Quality units', () => {
  assert.equal(formatPollutantUnit('MICROGRAMS_PER_CUBIC_METER'), 'µg/m³');
  assert.equal(formatPollutantUnit('PARTS_PER_BILLION'), 'ppb');
});

test('getAqiAtmosphere & resolveEffectiveTheme adapt automatically to good and bad air quality', () => {
  assert.equal(getAqiAtmosphere(42), 'good');
  assert.equal(getAqiAtmosphere(95), 'good');
  assert.equal(getAqiAtmosphere(165), 'moderate');
  assert.equal(getAqiAtmosphere(240), 'bad');
  assert.equal(getAqiAtmosphere(420), 'bad');

  const autoGood = resolveEffectiveTheme('auto', 48);
  assert.equal(autoGood.atmosphere, 'good');
  assert.equal(autoGood.isDark, false);

  const autoModerate = resolveEffectiveTheme('auto', 155);
  assert.equal(autoModerate.atmosphere, 'moderate');
  assert.equal(autoModerate.isDark, false);

  const autoBad = resolveEffectiveTheme('auto', 342);
  assert.equal(autoBad.atmosphere, 'bad');
  assert.equal(autoBad.isDark, true);

  const forcedLightBad = resolveEffectiveTheme('light', 342);
  assert.equal(forcedLightBad.atmosphere, 'bad');
  assert.equal(forcedLightBad.isDark, false);

  const forcedDarkGood = resolveEffectiveTheme('dark', 45);
  assert.equal(forcedDarkGood.atmosphere, 'good');
  assert.equal(forcedDarkGood.isDark, true);
});

test('sortDangerousLocations keeps NAQI > 200, deduplicates, and sorts highest first', () => {
  const sorted = sortDangerousLocations([
    {
      id: 'good-1',
      city: 'Kochi',
      areaName: 'Marine Drive',
      state: 'Kerala',
      lat: 9.97,
      lng: 76.27,
      aqi: 44,
      band: 'Good',
      dominantPollutant: 'PM2.5',
      isLive: true,
    },
    {
      id: 'bad-low',
      city: 'Kolkata',
      areaName: 'Howrah Ghusuri',
      state: 'West Bengal',
      lat: 22.61,
      lng: 88.35,
      aqi: 248,
      band: 'Poor',
      dominantPollutant: 'PM2.5',
      isLive: true,
    },
    {
      id: 'bad-high',
      city: 'New Delhi',
      areaName: 'Anand Vihar ISBT',
      state: 'Delhi',
      lat: 28.64,
      lng: 77.31,
      aqi: 412,
      band: 'Severe',
      dominantPollutant: 'PM2.5',
      isLive: true,
    },
    {
      id: 'bad-dup',
      city: 'New Delhi',
      areaName: 'Anand Vihar ISBT',
      state: 'Delhi',
      lat: 28.64,
      lng: 77.31,
      aqi: 390,
      band: 'Very Poor',
      dominantPollutant: 'PM2.5',
      isLive: false,
    },
  ]);

  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].areaName, 'Anand Vihar ISBT');
  assert.equal(sorted[1].areaName, 'Howrah Ghusuri');
});
