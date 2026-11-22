export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type IndianAqiBand =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

export interface AqiClassification {
  band: IndianAqiBand;
  summary: string;
  outdoorAdvice: string;
  bestWindow: string;
  accentHex: string;
  markerHex: string;
  textClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  borderClass: string;
}

export type AqiAtmosphere = 'good' | 'moderate' | 'bad';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface DangerousLocationAlert {
  id: string;
  city: string;
  areaName: string;
  state: string;
  lat: number;
  lng: number;
  aqi: number;
  band: IndianAqiBand;
  dominantPollutant: string;
  isLive: boolean;
}

export interface PollutantDetail {
  code: string;
  displayName: string;
  fullName: string;
  value: number;
  units: string;
  formattedUnit: string;
  safeLimit?: string;
  sources?: string;
  effects?: string;
}

export interface AqiIndexInfo {
  code: string;
  displayName: string;
  aqi: number;
  aqiDisplay: string;
  category: string;
  dominantPollutant?: string;
  color?: {
    red?: number;
    green?: number;
    blue?: number;
  };
}

export interface HealthRecommendations {
  generalPopulation?: string;
  elderly?: string;
  lungDiseasePopulation?: string;
  heartDiseasePopulation?: string;
  athletes?: string;
  pregnantWomen?: string;
  children?: string;
}

export interface HourlyForecastPoint {
  dateTime: string;
  label: string;
  aqi: number;
  uaqi?: number;
  category: string;
  dominantPollutant?: string;
}

export interface AreaProbeReading {
  id: string;
  areaName: string;
  zoneType: 'Transit & Industrial' | 'Commercial Core' | 'Residential' | 'Green Belt';
  city: string;
  lat: number;
  lng: number;
  aqi: number;
  band: IndianAqiBand;
  dominantPollutant: string;
  pm25?: number;
  isPrimary?: boolean;
  isLive: boolean;
  healthNote: string;
}

export interface AirQualitySnapshot {
  locationName: string;
  city: string;
  area: string;
  state: string;
  lat: number;
  lng: number;
  dateTime: string;
  indianAqi: number;
  classification: AqiClassification;
  dominantPollutant: string;
  localIndex?: AqiIndexInfo;
  universalIndex?: AqiIndexInfo;
  pollutants: PollutantDetail[];
  healthRecommendations: HealthRecommendations;
  forecast: HourlyForecastPoint[];
  areaBreakdown: AreaProbeReading[];
  dataSource: 'google-live' | 'live-cams' | 'fallback-baseline';
  quotaNotice?: boolean;
}

export type SensitiveGroup = 'children' | 'elderly' | 'asthma' | 'athletes';
export type CommuteMode = 'car_two_wheeler' | 'metro_bus' | 'walk_cycle' | 'remote';
export type HomeType = 'apartment_highrise' | 'ground_floor_roadside' | 'independent_house';
export type CookingFuel = 'lpg' | 'induction' | 'mixed_biomass';
export type PrimaryGoal =
  | 'protect_indoor'
  | 'reduce_emissions'
  | 'safe_commute'
  | 'community_action';

export interface HouseholdProfile {
  sensitiveGroups: SensitiveGroup[];
  commuteMode: CommuteMode;
  homeType: HomeType;
  cookingFuel: CookingFuel;
  primaryGoal: PrimaryGoal;
}

export type ActionCategory = 'routine' | 'indoor_hack' | 'sustainable_alt';

export interface PlanActionItem {
  id: string;
  category: ActionCategory;
  title: string;
  timeWindow: string;
  description: string;
  directImpactExplanation: string;
  exposureReductionPct: number;
  weeklyCo2SavedKg: number;
  weeklyPm25AvoidedGrams: number;
  costLevel: 'Free' | 'Low Cost' | 'Moderate';
}

export interface TailoredPlanResponse {
  summaryHeadline: string;
  whyThisMattersNow: string;
  bestOutdoorWindow: string;
  actions: PlanActionItem[];
  communityTip: string;
  generatedBy: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' | 'baseline-guide';
}

export type CollectiveImpactTier =
  | 'Not Started'
  | 'Starter'
  | 'Building Momentum'
  | 'High Impact'
  | 'Maximum Protection';

export interface ImpactSummary {
  adoptedCount: number;
  totalCount: number;
  collectiveImpactScore: number;
  collectiveImpactTier: CollectiveImpactTier;
  personalExposureReductionPct: number;
  weeklyCo2SavedKg: number;
  weeklyPm25AvoidedGrams: number;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
