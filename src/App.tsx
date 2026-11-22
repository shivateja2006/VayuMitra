import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { LocateFixed } from 'lucide-react';
import { CitySearchBar } from './components/CitySearchBar.tsx';
import { DangerousLocationsTicker } from './components/DangerousLocationsTicker.tsx';
import { AirQualityMapPanel } from './components/AirQualityMapPanel.tsx';
import { AirQualityTelemetry } from './components/AirQualityTelemetry.tsx';
import { HouseholdRoutinePlanner } from './components/HouseholdRoutinePlanner.tsx';
import { CommunityAssistantChat } from './components/CommunityAssistantChat.tsx';
import { INDIAN_CITY_PRESETS } from './data/indianCities.ts';
import {
  buildBaselineTailoredPlan,
  resolveEffectiveTheme,
  sortDangerousLocations,
} from './utils/airQualityLogic.ts';
import type {
  AirQualitySnapshot,
  AreaProbeReading,
  DangerousLocationAlert,
  HouseholdProfile,
  TailoredPlanResponse,
  ThemeMode,
} from './types/airQuality.ts';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_LOCATION = {
  lat: INDIAN_CITY_PRESETS[0].lat,
  lng: INDIAN_CITY_PRESETS[0].lng,
  city: INDIAN_CITY_PRESETS[0].city,
  area: INDIAN_CITY_PRESETS[0].defaultArea,
  state: INDIAN_CITY_PRESETS[0].state,
};

const DEFAULT_PROFILE: HouseholdProfile = {
  sensitiveGroups: ['children', 'elderly'],
  commuteMode: 'car_two_wheeler',
  homeType: 'apartment_highrise',
  cookingFuel: 'lpg',
  primaryGoal: 'protect_indoor',
};

const STORAGE_PROFILE_KEY = 'vayumitra_profile_v1';
const STORAGE_ADOPTED_KEY = 'vayumitra_adopted_v1';
const STORAGE_THEME_KEY = 'vayumitra_theme_v1';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'auto' || saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore storage errors
    }
    return 'auto';
  });

  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [selectedAreaId, setSelectedAreaId] = useState('delhi-cp');
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [isLoadingAq, setIsLoadingAq] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [globalDangerousAlerts, setGlobalDangerousAlerts] = useState<DangerousLocationAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  const [profile, setProfile] = useState<HouseholdProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILE_KEY);
      if (saved) return JSON.parse(saved) as HouseholdProfile;
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PROFILE;
  });

  const [adoptedIds, setAdoptedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ADOPTED_KEY);
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore storage errors
    }
    return ['routine-midday-shift'];
  });

  const [plan, setPlan] = useState<TailoredPlanResponse | null>(() =>
    buildBaselineTailoredPlan(
      DEFAULT_LOCATION.city,
      DEFAULT_LOCATION.area,
      INDIAN_CITY_PRESETS[0].winterBaselineAqi,
      DEFAULT_PROFILE
    )
  );
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const activeAqi = snapshot?.indianAqi ?? INDIAN_CITY_PRESETS[0].winterBaselineAqi;
  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(themeMode, activeAqi),
    [themeMode, activeAqi]
  );

  // Sync Tailwind .dark root class, data-aqi-theme attribute & localStorage theme mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveTheme.isDark);
    document.documentElement.dataset.aqiTheme = effectiveTheme.atmosphere;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, themeMode);
    } catch {
      // ignore storage errors
    }
  }, [effectiveTheme.isDark, effectiveTheme.atmosphere, themeMode]);

  // Listen for Google Maps Tier 1 & Tier 2 quota exhaustion events
  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ADOPTED_KEY, JSON.stringify(adoptedIds));
    } catch {
      // ignore storage errors
    }
  }, [adoptedIds]);

  // Load India-wide dangerous air quality zones for the top sliding ticker
  useEffect(() => {
    let active = true;
    async function loadDangerousAlerts() {
      setIsLoadingAlerts(true);
      try {
        const res = await fetch('/api/alerts/dangerous');
        if (!res.ok) return;
        const data = (await res.json()) as { alerts?: DangerousLocationAlert[] };
        if (active && Array.isArray(data.alerts)) {
          setGlobalDangerousAlerts(data.alerts);
        }
      } catch {
        // non-blocking
      } finally {
        if (active) setIsLoadingAlerts(false);
      }
    }
    void loadDangerousAlerts();
    return () => {
      active = false;
    };
  }, []);

  const mergedDangerousAlerts = useMemo(() => {
    const localAlerts: DangerousLocationAlert[] = (snapshot?.areaBreakdown || [])
      .filter((a) => a.aqi > 200)
      .map((a) => ({
        id: `local-${a.id}`,
        city: a.city,
        areaName: a.areaName,
        state: snapshot?.state || location.state,
        lat: a.lat,
        lng: a.lng,
        aqi: a.aqi,
        band: a.band,
        dominantPollutant: a.dominantPollutant,
        isLive: a.isLive,
      }));
    return sortDangerousLocations([...localAlerts, ...globalDangerousAlerts]);
  }, [snapshot?.areaBreakdown, snapshot?.state, location.state, globalDangerousAlerts]);

  const fetchAirQuality = useCallback(
    async (loc: typeof DEFAULT_LOCATION, targetAreaId?: string) => {
      setIsLoadingAq(true);
      setLocationError(null);
      try {
        const params = new URLSearchParams({
          lat: String(loc.lat),
          lng: String(loc.lng),
          city: loc.city,
          area: loc.area,
          state: loc.state,
        });
        const res = await fetch(`/api/air-quality?${params.toString()}`);
        const data = await res.json();

        if (res.status === 429 || data.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          if (data.snapshot) {
            setSnapshot(data.snapshot);
            const primary = data.snapshot.areaBreakdown?.find((a: AreaProbeReading) => a.isPrimary);
            if (targetAreaId || primary) {
              setSelectedAreaId(targetAreaId || primary.id);
            }
          }
          return;
        }

        if (!res.ok) {
          setLocationError(data.error || 'Unable to load air quality data.');
          return;
        }

        setSnapshot(data as AirQualitySnapshot);
        const primary = (data as AirQualitySnapshot).areaBreakdown.find((a) => a.isPrimary);
        setSelectedAreaId(targetAreaId || primary?.id || '');
      } catch {
        setLocationError('Network error loading air quality telemetry.');
      } finally {
        setIsLoadingAq(false);
      }
    },
    []
  );

  // Fetch initial air quality on mount
  useEffect(() => {
    void fetchAirQuality(DEFAULT_LOCATION, 'delhi-cp');
  }, [fetchAirQuality]);

  const generateTailoredPlan = useCallback(
    async (activeSnapshot: AirQualitySnapshot | null, activeProfile: HouseholdProfile) => {
      const activeCity = activeSnapshot?.city || location.city;
      const activeArea = activeSnapshot?.area || location.area;
      const activeState = activeSnapshot?.state || location.state;
      const activeSnapAqi = activeSnapshot?.indianAqi || INDIAN_CITY_PRESETS[0].winterBaselineAqi;
      const activeBand = activeSnapshot?.classification.band || 'Very Poor';
      const activeDominant = activeSnapshot?.dominantPollutant || 'PM2.5';

      setIsGeneratingPlan(true);
      setPlanError(null);

      try {
        const res = await fetch('/api/assistant/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { city: activeCity, area: activeArea, state: activeState },
            airQuality: {
              indianAqi: activeSnapAqi,
              band: activeBand,
              dominantPollutant: activeDominant,
              pollutants: activeSnapshot?.pollutants || [],
            },
            profile: activeProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPlanError(data.error || 'GenAI planner is currently unavailable.');
          setPlan(buildBaselineTailoredPlan(activeCity, activeArea, activeSnapAqi, activeProfile));
          return;
        }
        setPlan(data as TailoredPlanResponse);
      } catch {
        setPlanError('Network error generating tailored plan.');
        setPlan(buildBaselineTailoredPlan(activeCity, activeArea, activeSnapAqi, activeProfile));
      } finally {
        setIsGeneratingPlan(false);
      }
    },
    [location.area, location.city, location.state]
  );

  // Keep baseline plan synced to active city/AQI immediately
  useEffect(() => {
    if (!snapshot) return;
    setPlan((prev) => {
      if (prev && prev.generatedBy !== 'baseline-guide') {
        return prev;
      }
      return buildBaselineTailoredPlan(snapshot.city, snapshot.area, snapshot.indianAqi, profile);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.city, snapshot?.area, snapshot?.indianAqi]);

  function handleSelectLocation(nextLoc: typeof DEFAULT_LOCATION) {
    setLocation(nextLoc);
    void fetchAirQuality(nextLoc);
  }

  function handleSelectArea(area: AreaProbeReading) {
    const nextLoc = {
      lat: area.lat,
      lng: area.lng,
      city: area.city,
      area: area.areaName,
      state: location.state,
    };
    setLocation(nextLoc);
    setSelectedAreaId(area.id);
    void fetchAirQuality(nextLoc, area.id);
  }

  function handleSelectDangerousAlert(alert: DangerousLocationAlert) {
    const nextLoc = {
      lat: alert.lat,
      lng: alert.lng,
      city: alert.city,
      area: alert.areaName,
      state: alert.state,
    };
    setLocation(nextLoc);
    void fetchAirQuality(nextLoc);
  }

  async function handleMapCoordinateClick(lat: number, lng: number) {
    setLocationError(null);
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (res.status === 429 || data.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        return;
      }
      const nextLoc = {
        lat,
        lng,
        city: data.city || location.city,
        area: data.area || 'Pinned Area',
        state: data.state || location.state,
      };
      setLocation(nextLoc);
      void fetchAirQuality(nextLoc);
    } catch {
      const nextLoc = {
        lat,
        lng,
        city: location.city,
        area: `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`,
        state: location.state,
      };
      setLocation(nextLoc);
      void fetchAirQuality(nextLoc);
    }
  }

  function handleDetectLocation() {
    if (!('geolocation' in navigator)) {
      setLocationError('Browser geolocation is unavailable. Search your Indian city above.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (res.status === 429 || data.quotaExceeded) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          const nextLoc = {
            lat,
            lng,
            city: data.city || 'Detected City',
            area: data.area || 'Current Location',
            state: data.state || 'India',
          };
          setLocation(nextLoc);
          await fetchAirQuality(nextLoc);
        } catch {
          const nextLoc = {
            lat,
            lng,
            city: 'Current Location',
            area: `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`,
            state: 'India',
          };
          setLocation(nextLoc);
          await fetchAirQuality(nextLoc);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access was denied. Search your Indian city or select a metro below.');
        } else {
          setLocationError('Could not determine your GPS coordinates. Try searching your city.');
        }
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function handleToggleAction(actionId: string) {
    setAdoptedIds((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
      <div
        style={{
          backgroundImage:
            'radial-gradient(ellipse at top, var(--vm-glow-primary), var(--vm-glow-secondary) 44%, transparent 75%)',
        }}
        className="min-h-screen flex flex-col bg-[var(--vm-canvas)] text-[var(--vm-ink)] transition-colors duration-300"
      >
        {/* Mandatory Case A Demo Key Quota Banner (renders only on quota exhaustion) */}
        {quotaExceeded && (
          <div
            role="status"
            className="bg-amber-50 dark:bg-amber-950/90 border-b border-orange-200 dark:border-orange-700/60 text-amber-950 dark:text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50"
          >
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Strict 3-Zone Top Bar Contract */}
        <header className="bg-[var(--vm-header)] backdrop-blur-md border-b border-[var(--vm-border)] transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
            <a
              href="#top"
              className="text-lg font-bold tracking-tight text-[var(--vm-ink)] whitespace-nowrap shrink-0"
            >
              Vayu
              <span
                style={{
                  backgroundImage:
                    'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                }}
                className="bg-clip-text text-transparent"
              >
                Mitra
              </span>
            </a>

            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--vm-ink-secondary)]"
            >
              <a
                href="#air-map"
                className="hover:text-[var(--vm-accent-text)] transition-colors whitespace-nowrap shrink-0"
              >
                Air Map
              </a>
              <a
                href="#area-breakdown"
                className="hover:text-[var(--vm-accent-text)] transition-colors whitespace-nowrap shrink-0"
              >
                Area Breakdown
              </a>
              <a
                href="#daily-plan"
                className="hover:text-[var(--vm-accent-text)] transition-colors whitespace-nowrap shrink-0"
              >
                Daily Plan
              </a>
              <a
                href="#ask-assistant"
                className="hover:text-[var(--vm-accent-text)] transition-colors whitespace-nowrap shrink-0"
              >
                Ask Assistant
              </a>
            </nav>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                style={{
                  backgroundImage:
                    'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                }}
                className="px-4 py-2 text-xs font-semibold text-white hover:opacity-95 rounded-lg disabled:opacity-60 transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>{isLocating ? 'Locating...' : 'Use My Location'}</span>
              </button>
            </div>
          </div>
        </header>

        <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-6">
          <DangerousLocationsTicker
            alerts={mergedDangerousAlerts}
            isLoading={isLoadingAlerts}
            onSelectAlert={handleSelectDangerousAlert}
          />

          <CitySearchBar
            activeCity={snapshot?.city || location.city}
            activeArea={snapshot?.area || location.area}
            activeAqi={activeAqi}
            atmosphere={effectiveTheme.atmosphere}
            atmosphereLabel={effectiveTheme.label}
            isLocating={isLocating}
            locationError={locationError}
            themeMode={themeMode}
            onChangeThemeMode={setThemeMode}
            onSelectLocation={handleSelectLocation}
            onDetectLocation={handleDetectLocation}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 space-y-6">
              <AirQualityMapPanel
                apiKey={MAPS_API_KEY}
                center={{ lat: location.lat, lng: location.lng }}
                city={snapshot?.city || location.city}
                areas={snapshot?.areaBreakdown || []}
                selectedAreaId={selectedAreaId}
                dataSource={snapshot?.dataSource}
                onInspectArea={handleSelectArea}
                onMapCoordinateClick={handleMapCoordinateClick}
              />
            </div>

            <div className="lg:col-span-6">
              <AirQualityTelemetry
                snapshot={snapshot}
                isLoading={isLoadingAq}
                selectedAreaId={selectedAreaId}
                onSelectArea={handleSelectArea}
              />
            </div>
          </div>

          <HouseholdRoutinePlanner
            city={snapshot?.city || location.city}
            area={snapshot?.area || location.area}
            aqi={activeAqi}
            profile={profile}
            plan={plan}
            adoptedIds={adoptedIds}
            isGenerating={isGeneratingPlan}
            planError={planError}
            onUpdateProfile={setProfile}
            onGeneratePlan={() => void generateTailoredPlan(snapshot, profile)}
            onToggleAction={handleToggleAction}
          />

          <CommunityAssistantChat
            city={snapshot?.city || location.city}
            area={snapshot?.area || location.area}
            state={snapshot?.state || location.state}
            indianAqi={activeAqi}
            band={snapshot?.classification.band || 'Very Poor'}
            dominantPollutant={snapshot?.dominantPollutant || 'PM2.5'}
            profile={profile}
          />
        </main>

        <footer className="bg-[var(--vm-surface)] border-t border-[var(--vm-border)] mt-8 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--vm-ink-muted)]">
            <span>VayuMitra · India Clean Air &amp; Winter Smog Guidance</span>
            <span>CPCB NAQI Breakpoints · Adaptive AQI Theme Engine</span>
          </div>
        </footer>
      </div>
    </APIProvider>
  );
}
