import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { INDIAN_CITY_PRESETS } from './src/data/indianCities.ts';
import {
  buildAreaBreakdown,
  classifyIndianAqi,
  computeIndianNaqiFromPm25,
  findNearestCityPreset,
  formatPollutantUnit,
  getPollutantSafeLimit,
  sortDangerousLocations,
} from './src/utils/airQualityLogic.ts';
import type {
  AirQualitySnapshot,
  AqiIndexInfo,
  DangerousLocationAlert,
  HealthRecommendations,
  HouseholdProfile,
  HourlyForecastPoint,
  PollutantDetail,
  TailoredPlanResponse,
} from './src/types/airQuality.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAPS_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function getMapsApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  let extracted = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number; status?: string } };
    if (parsed?.error?.message) {
      extracted = parsed.error.message;
    }
  } catch {
    // not JSON
  }

  const lower = extracted.toLowerCase();
  if (lower.includes('resource_exhausted') || lower.includes('quota exceeded') || lower.includes('429')) {
    return {
      status: 429,
      message:
        'Daily free-tier Gemini AI request quota has been reached for this API key. Upgrade to a billing-enabled key in Settings > Secrets to continue live AI generation.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return {
      status: 403,
      message:
        'Gemini API key permission error. Please check your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message: 'VayuMitra AI is experiencing high demand right now. Please try again in a moment.',
    };
  }

  return { status: 502, message: extracted };
}

function isGeminiQuotaError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return raw.includes('resource_exhausted') || raw.includes('quota exceeded') || raw.includes('429');
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient =
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('overloaded');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

// 15-minute in-memory cache to conserve Maps Demo Key quota (100 req/day)
interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}
const CACHE_TTL_MS = 15 * 60 * 1000;
const aqCache = new Map<string, CacheEntry<AirQualitySnapshot>>();
const geocodeCache = new Map<string, CacheEntry<unknown>>();
let dangerousAlertsCache: CacheEntry<DangerousLocationAlert[]> | null = null;

const MONITORED_HOTSPOTS: Array<{
  id: string;
  city: string;
  areaName: string;
  state: string;
  lat: number;
  lng: number;
  baselineAqi: number;
}> = [
  {
    id: 'hot-anand-vihar',
    city: 'New Delhi',
    areaName: 'Anand Vihar ISBT',
    state: 'Delhi',
    lat: 28.6469,
    lng: 77.316,
    baselineAqi: 424,
  },
  {
    id: 'hot-rohini',
    city: 'New Delhi',
    areaName: 'Rohini Sector 16',
    state: 'Delhi',
    lat: 28.7325,
    lng: 77.1199,
    baselineAqi: 382,
  },
  {
    id: 'hot-rkpuram',
    city: 'New Delhi',
    areaName: 'R.K. Puram',
    state: 'Delhi',
    lat: 28.5651,
    lng: 77.1753,
    baselineAqi: 356,
  },
  {
    id: 'hot-ghaziabad',
    city: 'Ghaziabad',
    areaName: 'Loni Industrial',
    state: 'Uttar Pradesh',
    lat: 28.7515,
    lng: 77.2886,
    baselineAqi: 396,
  },
  {
    id: 'hot-noida',
    city: 'Noida',
    areaName: 'Sector 62',
    state: 'Uttar Pradesh',
    lat: 28.6279,
    lng: 77.3649,
    baselineAqi: 348,
  },
  {
    id: 'hot-gurugram',
    city: 'Gurugram',
    areaName: 'Udyog Vihar Phase IV',
    state: 'Haryana',
    lat: 28.5015,
    lng: 77.0789,
    baselineAqi: 342,
  },
  {
    id: 'hot-faridabad',
    city: 'Faridabad',
    areaName: 'Sector 16A',
    state: 'Haryana',
    lat: 28.4089,
    lng: 77.3178,
    baselineAqi: 329,
  },
  {
    id: 'hot-bhiwadi',
    city: 'Bhiwadi',
    areaName: 'RIICO Industrial',
    state: 'Rajasthan',
    lat: 28.2102,
    lng: 76.8606,
    baselineAqi: 364,
  },
  {
    id: 'hot-patna',
    city: 'Patna',
    areaName: 'Dakbungalow Chowk',
    state: 'Bihar',
    lat: 25.6093,
    lng: 85.1376,
    baselineAqi: 312,
  },
  {
    id: 'hot-lucknow',
    city: 'Lucknow',
    areaName: 'Talkatora Industrial',
    state: 'Uttar Pradesh',
    lat: 26.8351,
    lng: 80.8927,
    baselineAqi: 298,
  },
  {
    id: 'hot-kolkata',
    city: 'Kolkata',
    areaName: 'Howrah Ghusuri',
    state: 'West Bengal',
    lat: 22.6105,
    lng: 88.3547,
    baselineAqi: 268,
  },
];

function buildFallbackSnapshot(
  lat: number,
  lng: number,
  cityArg?: string,
  areaArg?: string,
  stateArg?: string,
  quotaNotice = false
): AirQualitySnapshot {
  const preset = findNearestCityPreset(lat, lng) || INDIAN_CITY_PRESETS[0];
  const city = cityArg || preset.city;
  const area = areaArg || preset.defaultArea;
  const state = stateArg || preset.state;
  const indianAqi = preset.winterBaselineAqi;
  const pm25Val = preset.winterPm25;
  const classification = classifyIndianAqi(indianAqi);

  const pollutants: PollutantDetail[] = [
    {
      code: 'pm25',
      displayName: 'PM2.5',
      fullName: 'Fine Particulate Matter (<2.5 µm)',
      value: pm25Val,
      units: 'MICROGRAMS_PER_CUBIC_METER',
      formattedUnit: 'µg/m³',
      safeLimit: getPollutantSafeLimit('pm25'),
      sources: 'Vehicular exhaust, winter biomass burning, construction dust, and secondary aerosols.',
      effects: 'Penetrates deep into alveoli and bloodstream, elevating respiratory and cardiac strain.',
    },
    {
      code: 'pm10',
      displayName: 'PM10',
      fullName: 'Coarse Particulate Matter (<10 µm)',
      value: Math.round(pm25Val * 1.62),
      units: 'MICROGRAMS_PER_CUBIC_METER',
      formattedUnit: 'µg/m³',
      safeLimit: getPollutantSafeLimit('pm10'),
      sources: 'Road dust resuspension, unpaved shoulders, and construction debris.',
      effects: 'Irritates eyes, nose, and upper airways; triggers coughing and wheezing.',
    },
    {
      code: 'no2',
      displayName: 'NO2',
      fullName: 'Nitrogen Dioxide',
      value: Math.round(pm25Val * 0.38),
      units: 'PARTS_PER_BILLION',
      formattedUnit: 'ppb',
      safeLimit: getPollutantSafeLimit('no2'),
      sources: 'Diesel trucks, two-wheelers, and backup power generators during winter inversions.',
      effects: 'Inflames bronchial lining and lowers resistance to respiratory infections.',
    },
    {
      code: 'o3',
      displayName: 'O3',
      fullName: 'Surface Ozone',
      value: 28,
      units: 'PARTS_PER_BILLION',
      formattedUnit: 'ppb',
      safeLimit: getPollutantSafeLimit('o3'),
      sources: 'Photochemical reaction of NOx and volatile organic compounds in sunlight.',
      effects: 'Can cause chest tightness during afternoon peaks.',
    },
  ];

  const now = new Date();
  const diurnalFactors = [1.0, 1.06, 1.08, 0.94, 0.78, 0.72, 0.8, 0.95];
  const forecast: HourlyForecastPoint[] = diurnalFactors.map((factor, idx) => {
    const dt = new Date(now.getTime() + idx * 3 * 60 * 60 * 1000);
    const aqi = Math.min(500, Math.max(25, Math.round(indianAqi * factor)));
    return {
      dateTime: dt.toISOString(),
      label: dt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      }),
      aqi,
      category: classifyIndianAqi(aqi).band,
      dominantPollutant: 'PM2.5',
    };
  });

  const areaBreakdown = buildAreaBreakdown({
    centerLat: lat,
    centerLng: lng,
    city,
    area,
    primaryAqi: indianAqi,
    dominantPollutant: 'PM2.5',
    pm25: pm25Val,
    isLivePrimary: false,
  });

  return {
    locationName: `${area}, ${city}`,
    city,
    area,
    state,
    lat,
    lng,
    dateTime: now.toISOString(),
    indianAqi,
    classification,
    dominantPollutant: 'PM2.5',
    localIndex: {
      code: 'ind_cpcb',
      displayName: 'India NAQI (CPCB)',
      aqi: indianAqi,
      aqiDisplay: String(indianAqi),
      category: `${classification.band} air quality`,
      dominantPollutant: 'pm25',
    },
    pollutants,
    healthRecommendations: {
      generalPopulation: classification.outdoorAdvice,
      children: 'Keep school commutes masked with N95 and avoid early-morning outdoor assembly.',
      elderly: 'Stay indoors during cold morning and late-evening inversion hours.',
      lungDiseasePopulation: 'Keep rescue inhalers accessible and run bedroom filtration continuously.',
      athletes: 'Move training indoors or wait for the 13:00–15:30 solar mixing window.',
    },
    forecast,
    areaBreakdown,
    dataSource: 'fallback-baseline',
    quotaNotice,
  };
}

async function fetchLiveOpenMeteoAirQuality(
  lat: number,
  lng: number,
  cityArg?: string,
  areaArg?: string,
  stateArg?: string
): Promise<AirQualitySnapshot | null> {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set(
      'current',
      'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide'
    );
    url.searchParams.set('hourly', 'pm2_5');
    url.searchParams.set('timezone', 'Asia/Kolkata');
    url.searchParams.set('forecast_days', '2');

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        time?: string;
        pm2_5?: number;
        pm10?: number;
        nitrogen_dioxide?: number;
        ozone?: number;
        sulphur_dioxide?: number;
        carbon_monoxide?: number;
      };
      hourly?: {
        time?: string[];
        pm2_5?: number[];
      };
    };

    const pm25 = Number((data.current?.pm2_5 ?? 0).toFixed(1));
    const pm10 = Number((data.current?.pm10 ?? 0).toFixed(1));
    const no2 = Number((data.current?.nitrogen_dioxide ?? 0).toFixed(1));
    const o3 = Number((data.current?.ozone ?? 0).toFixed(1));
    const so2 = Number((data.current?.sulphur_dioxide ?? 0).toFixed(1));
    const co = Number((data.current?.carbon_monoxide ?? 0).toFixed(1));

    const indianAqi = computeIndianNaqiFromPm25(pm25);
    const classification = classifyIndianAqi(indianAqi);
    const nearestPreset = findNearestCityPreset(lat, lng);
    const city = cityArg || nearestPreset?.city || 'Selected City';
    const area = areaArg || nearestPreset?.defaultArea || city;
    const state = stateArg || nearestPreset?.state || 'India';

    const pollutants: PollutantDetail[] = [
      {
        code: 'pm25',
        displayName: 'PM2.5',
        fullName: 'Fine Particulate Matter (<2.5 µm)',
        value: pm25,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('pm25'),
        sources: 'Vehicular exhaust, winter biomass burning, construction dust, and secondary aerosols.',
        effects: 'Penetrates deep into alveoli and bloodstream, elevating respiratory and cardiac strain.',
      },
      {
        code: 'pm10',
        displayName: 'PM10',
        fullName: 'Coarse Particulate Matter (<10 µm)',
        value: pm10,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('pm10'),
        sources: 'Road dust resuspension, unpaved shoulders, and urban construction activity.',
        effects: 'Irritates eyes, throat, and upper airways during dry winter conditions.',
      },
      {
        code: 'no2',
        displayName: 'NO2',
        fullName: 'Nitrogen Dioxide',
        value: no2,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('no2'),
        sources: 'Traffic combustion, diesel freight, and backup power generators.',
        effects: 'Inflames bronchial lining and increases asthma sensitivity.',
      },
      {
        code: 'o3',
        displayName: 'O3',
        fullName: 'Surface Ozone',
        value: o3,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('o3'),
        sources: 'Photochemical reaction of NOx and hydrocarbons under midday sunlight.',
        effects: 'Can irritate lungs during peak afternoon sunshine.',
      },
      {
        code: 'so2',
        displayName: 'SO2',
        fullName: 'Sulfur Dioxide',
        value: so2,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('so2'),
        sources: 'Industrial boilers, coal power units, and heavy diesel fuel.',
        effects: 'Causes airway constriction in sensitive individuals.',
      },
      {
        code: 'co',
        displayName: 'CO',
        fullName: 'Carbon Monoxide',
        value: co,
        units: 'MICROGRAMS_PER_CUBIC_METER',
        formattedUnit: 'µg/m³',
        safeLimit: getPollutantSafeLimit('co'),
        sources: 'Incomplete vehicle engine combustion and solid-fuel heating.',
        effects: 'Reduces oxygen delivery to tissues during prolonged exposure.',
      },
    ];

    const times = data.hourly?.time || [];
    const pm25Series = data.hourly?.pm2_5 || [];
    const nowMs = Date.now();
    const forecast: HourlyForecastPoint[] = [];

    for (let i = 0; i < times.length && forecast.length < 8; i++) {
      const iso = `${times[i]}:00+05:30`;
      const ms = Date.parse(iso);
      if (!Number.isFinite(ms) || ms < nowMs - 30 * 60 * 1000) continue;
      if (forecast.length === 0 || ms - Date.parse(forecast[forecast.length - 1].dateTime) >= 2.8 * 60 * 60 * 1000) {
        const hAqi = computeIndianNaqiFromPm25(pm25Series[i] ?? pm25);
        forecast.push({
          dateTime: iso,
          label: times[i].slice(11, 16),
          aqi: hAqi,
          category: classifyIndianAqi(hAqi).band,
          dominantPollutant: 'PM2.5',
        });
      }
    }

    const areaBreakdown = buildAreaBreakdown({
      centerLat: lat,
      centerLng: lng,
      city,
      area,
      primaryAqi: indianAqi,
      dominantPollutant: 'PM2.5',
      pm25,
      isLivePrimary: true,
    });

    return {
      locationName: `${area}, ${city}`,
      city,
      area,
      state,
      lat,
      lng,
      dateTime: new Date().toISOString(),
      indianAqi,
      classification,
      dominantPollutant: 'PM2.5',
      localIndex: {
        code: 'ind_cpcb',
        displayName: 'India NAQI (CPCB)',
        aqi: indianAqi,
        aqiDisplay: String(indianAqi),
        category: `${classification.band} air quality`,
        dominantPollutant: 'pm25',
      },
      pollutants,
      healthRecommendations: {
        generalPopulation: classification.outdoorAdvice,
        children:
          indianAqi > 200
            ? 'Limit morning outdoor time and use a well-fitted N95 mask for school commutes.'
            : classification.outdoorAdvice,
        elderly:
          indianAqi > 200
            ? 'Stay indoors during cold early morning and late-evening inversion hours.'
            : classification.outdoorAdvice,
        lungDiseasePopulation: 'Keep prescribed inhalers accessible and run bedroom air filtration.',
        athletes: `Prefer ${classification.bestWindow} for lighter activity if outdoor exercise is needed.`,
      },
      forecast,
      areaBreakdown,
      dataSource: 'live-cams',
    };
  } catch {
    return null;
  }
}

function isQuotaError(status: number, body: unknown): boolean {
  if (status === 429) return true;
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: { status?: string; message?: string } }).error;
    if (err?.status === 'RESOURCE_EXHAUSTED') return true;
    if (err?.message && err.message.toLowerCase().includes('quota')) return true;
  }
  return false;
}

function extractCityComponents(components: Array<{ longText?: string; shortText?: string; types?: string[] }> = []) {
  let area = '';
  let city = '';
  let state = '';
  for (const c of components) {
    const types = c.types || [];
    const text = c.longText || c.shortText || '';
    if (!area && (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood'))) {
      area = text;
    }
    if (!city && (types.includes('locality') || types.includes('administrative_area_level_2'))) {
      city = text;
    }
    if (!state && types.includes('administrative_area_level_1')) {
      state = text;
    }
  }
  return { area, city, state };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Live India-wide Dangerous Air Quality Hotspots (NAQI > 200: Poor / Very Poor / Severe)
  app.get('/api/alerts/dangerous', async (_req, res) => {
    if (dangerousAlertsCache && dangerousAlertsCache.expiresAt > Date.now()) {
      res.json({ alerts: dangerousAlertsCache.data });
      return;
    }

    const alerts: DangerousLocationAlert[] = [];
    try {
      const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      url.searchParams.set('latitude', MONITORED_HOTSPOTS.map((h) => h.lat).join(','));
      url.searchParams.set('longitude', MONITORED_HOTSPOTS.map((h) => h.lng).join(','));
      url.searchParams.set('current', 'pm2_5');
      url.searchParams.set('timezone', 'Asia/Kolkata');

      const response = await fetch(url.toString());
      if (response.ok) {
        const raw = (await response.json()) as
          | Array<{ current?: { pm2_5?: number } }>
          | { current?: { pm2_5?: number } };
        const items = Array.isArray(raw) ? raw : [raw];

        MONITORED_HOTSPOTS.forEach((spot, index) => {
          const pm25 = items[index]?.current?.pm2_5;
          if (typeof pm25 === 'number' && Number.isFinite(pm25)) {
            const aqi = computeIndianNaqiFromPm25(pm25);
            if (aqi > 200) {
              const cls = classifyIndianAqi(aqi);
              alerts.push({
                id: spot.id,
                city: spot.city,
                areaName: spot.areaName,
                state: spot.state,
                lat: spot.lat,
                lng: spot.lng,
                aqi,
                band: cls.band,
                dominantPollutant: 'PM2.5',
                isLive: true,
              });
            }
          }
        });
      }
    } catch {
      // Fall back below if network fails
    }

    // If live readings are partially unavailable or < 4 winter hotspots crossed 200 right now,
    // supplement with CPCB winter high-alert baselines marked isLive: false so the alert ticker stays informative
    if (alerts.length < 4) {
      for (const spot of MONITORED_HOTSPOTS) {
        if (alerts.some((a) => a.id === spot.id)) continue;
        const cls = classifyIndianAqi(spot.baselineAqi);
        alerts.push({
          id: spot.id,
          city: spot.city,
          areaName: spot.areaName,
          state: spot.state,
          lat: spot.lat,
          lng: spot.lng,
          aqi: spot.baselineAqi,
          band: cls.band,
          dominantPollutant: 'PM2.5',
          isLive: false,
        });
        if (alerts.length >= 6) break;
      }
    }

    const sorted = sortDangerousLocations(alerts);
    dangerousAlertsCache = { expiresAt: Date.now() + CACHE_TTL_MS, data: sorted };
    res.json({ alerts: sorted });
  });

  // Reverse geocode lat/lng -> Indian city & neighborhood name
  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
      return;
    }

    const cacheKey = `rev:${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      const preset = findNearestCityPreset(lat, lng);
      res.json({
        city: preset?.city || 'Selected Location',
        area: preset?.defaultArea || `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`,
        state: preset?.state || 'India',
        formattedAddress: preset ? `${preset.defaultArea}, ${preset.city}` : `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      });
      return;
    }

    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
      url.searchParams.append('location.latitude', String(lat));
      url.searchParams.append('location.longitude', String(lng));
      url.searchParams.append('languageCode', 'en');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.addressComponents',
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (isQuotaError(response.status, payload)) {
        res.status(429).json({
          quotaExceeded: true,
          error: payload.error || { status: 'RESOURCE_EXHAUSTED', message: 'Maps quota reached' },
        });
        return;
      }

      if (!response.ok || !Array.isArray(payload.results) || payload.results.length === 0) {
        const preset = findNearestCityPreset(lat, lng);
        const fallback = {
          city: preset?.city || 'Detected Location',
          area: preset?.defaultArea || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
          state: preset?.state || 'India',
          formattedAddress: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        };
        res.json(fallback);
        return;
      }

      const first = payload.results[0];
      const extracted = extractCityComponents(first.addressComponents);
      const result = {
        city: extracted.city || extracted.area || 'India',
        area: extracted.area || extracted.city || 'Local Zone',
        state: extracted.state || 'India',
        formattedAddress: first.formattedAddress || `${extracted.area}, ${extracted.city}`,
      };
      geocodeCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Reverse geocoding failed.',
      });
    }
  });

  // Forward geocode a city or neighborhood query in India
  app.get('/api/geocode', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Search query q is required.' });
      return;
    }

    const cacheKey = `fwd:${query.toLowerCase()}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      res.status(503).json({ error: 'Google Maps API key is not configured.' });
      return;
    }

    try {
      const encoded = encodeURIComponent(query);
      const url = `https://geocode.googleapis.com/v4/geocode/address/${encoded}?regionCode=in&languageCode=en`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask':
            'results.placeId,results.location,results.formattedAddress,results.addressComponents',
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (isQuotaError(response.status, payload)) {
        res.status(429).json({
          quotaExceeded: true,
          error: payload.error || { status: 'RESOURCE_EXHAUSTED', message: 'Maps quota reached' },
        });
        return;
      }

      if (!response.ok || !Array.isArray(payload.results) || payload.results.length === 0) {
        res.status(404).json({ error: `No location found for "${query}".` });
        return;
      }

      const first = payload.results[0];
      const extracted = extractCityComponents(first.addressComponents);
      const lat = first.location?.latitude;
      const lng = first.location?.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        res.status(404).json({ error: `No coordinates returned for "${query}".` });
        return;
      }

      const result = {
        lat,
        lng,
        city: extracted.city || query,
        area: extracted.area || extracted.city || query,
        state: extracted.state || 'India',
        formattedAddress: first.formattedAddress || query,
      };
      geocodeCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Geocoding request failed.',
      });
    }
  });

  // Live Google Air Quality API proxy (currentConditions + forecast)
  app.get('/api/air-quality', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const cityArg = req.query.city ? String(req.query.city) : undefined;
    const areaArg = req.query.area ? String(req.query.area) : undefined;
    const stateArg = req.query.state ? String(req.query.state) : undefined;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid lat and lng parameters are required.' });
      return;
    }

    const cacheKey = `aq:${lat.toFixed(2)},${lng.toFixed(2)}:${cityArg || ''}:${areaArg || ''}`;
    const cached = aqCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      const liveFallback = await fetchLiveOpenMeteoAirQuality(lat, lng, cityArg, areaArg, stateArg);
      const snapshot = liveFallback || buildFallbackSnapshot(lat, lng, cityArg, areaArg, stateArg, false);
      aqCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: snapshot });
      res.json(snapshot);
      return;
    }

    try {
      const currentUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${mapsKey}`;
      const currentRes = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
        body: JSON.stringify({
          universalAqi: true,
          location: { latitude: lat, longitude: lng },
          extraComputations: [
            'HEALTH_RECOMMENDATIONS',
            'DOMINANT_POLLUTANT_CONCENTRATION',
            'POLLUTANT_CONCENTRATION',
            'LOCAL_AQI',
            'POLLUTANT_ADDITIONAL_INFO',
          ],
          languageCode: 'en',
        }),
      });

      const currentData = await currentRes.json().catch(() => ({}));

      if (isQuotaError(currentRes.status, currentData)) {
        const liveFallback = await fetchLiveOpenMeteoAirQuality(lat, lng, cityArg, areaArg, stateArg);
        const fallback = liveFallback || buildFallbackSnapshot(lat, lng, cityArg, areaArg, stateArg, true);
        res.status(429).json({
          quotaExceeded: true,
          error: currentData.error || { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' },
          snapshot: fallback,
        });
        return;
      }

      if (!currentRes.ok) {
        const liveFallback = await fetchLiveOpenMeteoAirQuality(lat, lng, cityArg, areaArg, stateArg);
        const fallback = liveFallback || buildFallbackSnapshot(lat, lng, cityArg, areaArg, stateArg, false);
        aqCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: fallback });
        res.json(fallback);
        return;
      }

      const indexes: AqiIndexInfo[] = Array.isArray(currentData.indexes) ? currentData.indexes : [];
      const universalIndex = indexes.find((i) => i.code === 'uaqi');
      const localIndex =
        indexes.find((i) => i.code === 'ind_cpcb') ||
        indexes.find((i) => i.code !== 'uaqi');

      const rawPollutants = Array.isArray(currentData.pollutants) ? currentData.pollutants : [];
      const pollutants: PollutantDetail[] = rawPollutants.map(
        (p: {
          code?: string;
          displayName?: string;
          fullName?: string;
          concentration?: { value?: number; units?: string };
          additionalInfo?: { sources?: string; effects?: string };
        }) => {
          const code = p.code || 'unknown';
          const units = p.concentration?.units || 'MICROGRAMS_PER_CUBIC_METER';
          return {
            code,
            displayName: p.displayName || code.toUpperCase(),
            fullName: p.fullName || code.toUpperCase(),
            value: Number((p.concentration?.value ?? 0).toFixed(1)),
            units,
            formattedUnit: formatPollutantUnit(units),
            safeLimit: getPollutantSafeLimit(code),
            sources: p.additionalInfo?.sources,
            effects: p.additionalInfo?.effects,
          };
        }
      );

      const pm25Reading = pollutants.find((p) => p.code.toLowerCase() === 'pm25')?.value;
      let indianAqi = 150;
      if (localIndex && localIndex.code === 'ind_cpcb') {
        indianAqi = localIndex.aqi;
      } else if (typeof pm25Reading === 'number' && pm25Reading > 0) {
        indianAqi = computeIndianNaqiFromPm25(pm25Reading);
      } else if (universalIndex) {
        // Universal AQI runs 0 (worst) to 100 (best); approximate CPCB inverse if PM2.5 omitted
        indianAqi = Math.max(20, Math.round((100 - universalIndex.aqi) * 4.2));
      }

      const classification = classifyIndianAqi(indianAqi);
      const dominantPollutant = (
        localIndex?.dominantPollutant ||
        universalIndex?.dominantPollutant ||
        'pm25'
      ).toUpperCase();

      // Fetch 24h forecast (next 24h in 3-hour intervals via pageSize: 24)
      let forecast: HourlyForecastPoint[] = [];
      try {
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60 * 1000);
        const end = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        const forecastUrl = `https://airquality.googleapis.com/v1/forecast:lookup?key=${mapsKey}`;
        const forecastRes = await fetch(forecastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
          },
          body: JSON.stringify({
            pageSize: 24,
            universalAqi: true,
            location: { latitude: lat, longitude: lng },
            period: {
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            },
            languageCode: 'en',
            extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
          }),
        });

        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          const hourly = Array.isArray(forecastData.hourlyForecasts)
            ? forecastData.hourlyForecasts
            : [];
          // Sample every 3 hours for clean 8-point timeline
          forecast = hourly
            .filter((_: unknown, idx: number) => idx % 3 === 0)
            .slice(0, 8)
            .map(
              (entry: {
                dateTime: string;
                indexes?: AqiIndexInfo[];
                pollutants?: Array<{ code?: string; concentration?: { value?: number } }>;
              }) => {
                const fIndexes = entry.indexes || [];
                const fLocal = fIndexes.find((i) => i.code === 'ind_cpcb');
                const fUaqi = fIndexes.find((i) => i.code === 'uaqi');
                const fPm25 = entry.pollutants?.find((p) => p.code === 'pm25')?.concentration?.value;
                const fAqi =
                  fLocal?.aqi ??
                  (typeof fPm25 === 'number'
                    ? computeIndianNaqiFromPm25(fPm25)
                    : fUaqi
                      ? Math.max(20, Math.round((100 - fUaqi.aqi) * 4.2))
                      : indianAqi);
                const dt = new Date(entry.dateTime);
                return {
                  dateTime: entry.dateTime,
                  label: dt.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata',
                  }),
                  aqi: fAqi,
                  uaqi: fUaqi?.aqi,
                  category: classifyIndianAqi(fAqi).band,
                  dominantPollutant: (fLocal?.dominantPollutant || fUaqi?.dominantPollutant || 'PM25').toUpperCase(),
                };
              }
            );
        }
      } catch {
        // Fall back to diurnal curve below if forecast fails
      }

      if (forecast.length === 0) {
        const now = new Date();
        const factors = [1.0, 1.05, 1.02, 0.88, 0.76, 0.72, 0.84, 0.96];
        forecast = factors.map((f, idx) => {
          const dt = new Date(now.getTime() + (idx + 1) * 3 * 60 * 60 * 1000);
          const aqi = Math.min(500, Math.max(20, Math.round(indianAqi * f)));
          return {
            dateTime: dt.toISOString(),
            label: dt.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Kolkata',
            }),
            aqi,
            category: classifyIndianAqi(aqi).band,
            dominantPollutant,
          };
        });
      }

      const nearestPreset = findNearestCityPreset(lat, lng);
      const city = cityArg || nearestPreset?.city || 'Selected City';
      const area = areaArg || nearestPreset?.defaultArea || city;
      const state = stateArg || nearestPreset?.state || 'India';

      const areaBreakdown = buildAreaBreakdown({
        centerLat: lat,
        centerLng: lng,
        city,
        area,
        primaryAqi: indianAqi,
        dominantPollutant,
        pm25: pm25Reading,
        isLivePrimary: true,
      });

      const healthRecommendations: HealthRecommendations = currentData.healthRecommendations || {
        generalPopulation: classification.outdoorAdvice,
      };

      const snapshot: AirQualitySnapshot = {
        locationName: `${area}, ${city}`,
        city,
        area,
        state,
        lat,
        lng,
        dateTime: currentData.dateTime || new Date().toISOString(),
        indianAqi,
        classification,
        dominantPollutant,
        localIndex: localIndex || {
          code: 'ind_cpcb_derived',
          displayName: 'India NAQI (CPCB)',
          aqi: indianAqi,
          aqiDisplay: String(indianAqi),
          category: `${classification.band} air quality`,
          dominantPollutant,
        },
        universalIndex,
        pollutants,
        healthRecommendations,
        forecast,
        areaBreakdown,
        dataSource: 'google-live',
      };

      aqCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: snapshot });
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Air Quality lookup failed.',
      });
    }
  });

  // GenAI Tailored Routine, Indoor Air Hacks & Impact Plan (gemini-4-hydrogen)
  app.post('/api/assistant/plan', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Check Settings > Secrets to enable GenAI planning.',
      });
      return;
    }

    const { location, airQuality, profile } = req.body as {
      location?: { city?: string; area?: string; state?: string };
      airQuality?: {
        indianAqi?: number;
        band?: string;
        dominantPollutant?: string;
        pollutants?: Array<{ displayName: string; value: number; formattedUnit: string }>;
      };
      profile?: HouseholdProfile;
    };

    if (!location?.city || !airQuality || !profile) {
      res.status(400).json({ error: 'location, airQuality, and profile are required.' });
      return;
    }

    const pollutantLines = (airQuality.pollutants || [])
      .slice(0, 5)
      .map((p) => `${p.displayName}: ${p.value} ${p.formattedUnit}`)
      .join(', ');

    const prompt = [
      `Location: ${location.area || location.city}, ${location.city}, ${location.state || 'India'}`,
      `Current India NAQI (CPCB): ${airQuality.indianAqi} (${airQuality.band})`,
      `Dominant Pollutant: ${airQuality.dominantPollutant}`,
      `Measured Concentrations: ${pollutantLines || 'PM2.5 elevated'}`,
      `Household Profile:`,
      `- Sensitive family members: ${profile.sensitiveGroups.join(', ') || 'None specified'}`,
      `- Primary commute: ${profile.commuteMode}`,
      `- Home setup: ${profile.homeType}`,
      `- Cooking fuel: ${profile.cookingFuel}`,
      `- Primary focus: ${profile.primaryGoal}`,
      '',
      'Generate exactly 6 practical, culturally grounded Indian winter smog action items (2 with category "routine", 2 with category "indoor_hack", 2 with category "sustainable_alt").',
      'Every item must explain the DIRECT impact of the family choice (both personal inhaled PM2.5 exposure reduction % and community emissions avoided in weekly kg CO2e and grams of PM2.5).',
      'Avoid generic Western advice (no central HVAC duct tips); focus on real Indian apartments, balconies, tadka exhaust, wet mopping vs dry jhadu, Metro/CNG/EV trips, DIY box-fan HEPA filters, RWA zero-leaf-burning, and solar/induction swaps.',
    ].join('\n');

    try {
      const planSchema = {
        type: Type.OBJECT,
        properties: {
          summaryHeadline: { type: Type.STRING },
          whyThisMattersNow: { type: Type.STRING },
          bestOutdoorWindow: { type: Type.STRING },
          communityTip: { type: Type.STRING },
          actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                timeWindow: { type: Type.STRING },
                description: { type: Type.STRING },
                directImpactExplanation: { type: Type.STRING },
                exposureReductionPct: { type: Type.NUMBER },
                weeklyCo2SavedKg: { type: Type.NUMBER },
                weeklyPm25AvoidedGrams: { type: Type.NUMBER },
                costLevel: { type: Type.STRING },
              },
              required: [
                'id',
                'category',
                'title',
                'timeWindow',
                'description',
                'directImpactExplanation',
                'exposureReductionPct',
                'weeklyCo2SavedKg',
                'weeklyPm25AvoidedGrams',
                'costLevel',
              ],
            },
          },
        },
        required: [
          'summaryHeadline',
          'whyThisMattersNow',
          'bestOutdoorWindow',
          'communityTip',
          'actions',
        ],
      };

      const systemInstruction =
        'You are VayuMitra, an environmental health and urban sustainability advisor specializing in Indian winter smog, CPCB air quality dynamics, indoor air quality engineering, and low-emission community habits. Keep advice concise, practical, medically cautious, and quantitatively grounded.';

      let usedModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' = 'gemini-4-hydrogen';
      let response;
      try {
        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: planSchema,
            },
          })
        );
      } catch (primaryErr) {
        if (!isGeminiQuotaError(primaryErr)) throw primaryErr;
        usedModel = 'gemini-3.1-flash-lite';
        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: planSchema,
            },
          })
        );
      }

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText) as Omit<TailoredPlanResponse, 'generatedBy'>;
      const normalizedActions = (parsed.actions || []).slice(0, 6).map((a, idx) => ({
        ...a,
        id: a.id || `genai-action-${idx}`,
        category:
          a.category === 'routine' || a.category === 'indoor_hack' || a.category === 'sustainable_alt'
            ? a.category
            : idx < 2
              ? 'routine'
              : idx < 4
                ? 'indoor_hack'
                : 'sustainable_alt',
        costLevel:
          a.costLevel === 'Free' || a.costLevel === 'Low Cost' || a.costLevel === 'Moderate'
            ? a.costLevel
            : 'Low Cost',
        exposureReductionPct: Math.min(55, Math.max(4, Math.round(Number(a.exposureReductionPct) || 12))),
        weeklyCo2SavedKg: Math.max(0, Number(Number(a.weeklyCo2SavedKg || 0).toFixed(1))),
        weeklyPm25AvoidedGrams: Math.max(0, Number(Number(a.weeklyPm25AvoidedGrams || 0).toFixed(1))),
      }));

      res.json({
        ...parsed,
        actions: normalizedActions,
        generatedBy: usedModel,
      } satisfies TailoredPlanResponse);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // GenAI Community & Family Q&A endpoint (gemini-4-hydrogen)
  app.post('/api/assistant/ask', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Check Settings > Secrets to ask VayuMitra.',
      });
      return;
    }

    const { question, location, airQuality, profile } = req.body as {
      question?: string;
      location?: { city?: string; area?: string; state?: string };
      airQuality?: { indianAqi?: number; band?: string; dominantPollutant?: string };
      profile?: HouseholdProfile;
    };

    if (!question?.trim()) {
      res.status(400).json({ error: 'Question cannot be empty.' });
      return;
    }

    const contextPrompt = [
      `Active Location: ${location?.area || ''}, ${location?.city || 'India'}, ${location?.state || ''}`,
      `Current India NAQI: ${airQuality?.indianAqi ?? 'Unknown'} (${airQuality?.band ?? ''}), Dominant Pollutant: ${airQuality?.dominantPollutant ?? 'PM2.5'}`,
      `Household: sensitiveGroups=${profile?.sensitiveGroups?.join(',') || 'none'}, commute=${profile?.commuteMode || 'unknown'}, home=${profile?.homeType || 'apartment'}, fuel=${profile?.cookingFuel || 'lpg'}`,
      `User Question: ${question.trim()}`,
    ].join('\n');

    try {
      const systemInstruction =
        'You are VayuMitra, an empathetic, practical Indian air-quality and winter-smog community advisor. Answer in 3-5 clear sentences or concise bullet points. Reference the specific city/area NAQI and explain the direct exposure or emission impact of the user’s choice. Do not invent fake sensor readings beyond what is provided.';
      let response;
      try {
        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: contextPrompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );
      } catch (primaryErr) {
        if (!isGeminiQuotaError(primaryErr)) throw primaryErr;
        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: contextPrompt,
            config: {
              systemInstruction,
            },
          })
        );
      }

      res.json({
        answer: (response.text || '').trim() || 'Unable to generate an answer right now.',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Serve Vite middleware in dev, or built dist/ in production
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VayuMitra server listening on http://localhost:${PORT}`);
  });
}

void createApp();
