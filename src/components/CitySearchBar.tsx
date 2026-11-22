import { useState, useRef, useEffect, type FormEvent } from 'react';
import { LocateFixed, Search, Loader2, Sun, Moon, Sparkles } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions.ts';
import { INDIAN_CITY_PRESETS, type IndianCityPreset } from '../data/indianCities.ts';
import { formatLocationLabel } from '../utils/airQualityLogic.ts';
import type { AqiAtmosphere, ThemeMode } from '../types/airQuality.ts';

interface SelectedLocationPayload {
  lat: number;
  lng: number;
  city: string;
  area: string;
  state: string;
}

interface CitySearchBarProps {
  activeCity: string;
  activeArea: string;
  activeAqi: number;
  atmosphere: AqiAtmosphere;
  atmosphereLabel: string;
  isLocating: boolean;
  locationError: string | null;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onSelectLocation: (loc: SelectedLocationPayload) => void;
  onDetectLocation: () => void;
}

export function CitySearchBar({
  activeCity,
  activeArea,
  activeAqi,
  atmosphere,
  atmosphereLabel,
  isLocating,
  locationError,
  themeMode,
  onChangeThemeMode,
  onSelectLocation,
  onDetectLocation,
}: CitySearchBarProps) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { suggestions, isLoading: isSuggesting, resetSession } = useAutocompleteSuggestions(query);

  useEffect(() => {
    function handleOutsideClick(ev: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function handleSuggestionSelect(suggestion: google.maps.places.AutocompleteSuggestion) {
    if (!placesLib || !suggestion.placePrediction) return;
    setSearchError(null);
    setIsOpen(false);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      });

      const loc = place.location;
      if (!loc) {
        setSearchError('Selected place did not return coordinates.');
        return;
      }

      let city = place.displayName || '';
      let area = place.displayName || '';
      let state = 'India';

      for (const comp of place.addressComponents || []) {
        if (comp.types.includes('locality')) city = comp.longText || city;
        if (
          comp.types.includes('sublocality_level_1') ||
          comp.types.includes('sublocality') ||
          comp.types.includes('neighborhood')
        ) {
          area = comp.longText || area;
        }
        if (comp.types.includes('administrative_area_level_1')) {
          state = comp.longText || state;
        }
      }

      setQuery('');
      resetSession();
      onSelectLocation({
        lat: loc.lat(),
        lng: loc.lng(),
        city: city || area,
        area: area || city,
        state,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('OVER_QUERY_LIMIT')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setSearchError('Could not load details for that location. Try pressing Enter to search.');
    }
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearchError(null);
    setIsOpen(false);

    const presetMatch = INDIAN_CITY_PRESETS.find(
      (p) => p.city.toLowerCase() === trimmed.toLowerCase()
    );
    if (presetMatch) {
      setQuery('');
      resetSession();
      onSelectLocation({
        lat: presetMatch.lat,
        lng: presetMatch.lng,
        city: presetMatch.city,
        area: presetMatch.defaultArea,
        state: presetMatch.state,
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (res.status === 429 || data.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Maps search quota reached; choose one of the Indian metro presets below.');
        return;
      }
      if (!res.ok) {
        setSearchError(data.error || `Could not find "${trimmed}" in India.`);
        return;
      }
      setQuery('');
      resetSession();
      onSelectLocation({
        lat: data.lat,
        lng: data.lng,
        city: data.city,
        area: data.area,
        state: data.state,
      });
    } catch {
      setSearchError('Network error while searching for city.');
    } finally {
      setIsGeocoding(false);
    }
  }

  function handlePresetClick(preset: IndianCityPreset) {
    setSearchError(null);
    setIsOpen(false);
    setQuery('');
    onSelectLocation({
      lat: preset.lat,
      lng: preset.lng,
      city: preset.city,
      area: preset.defaultArea,
      state: preset.state,
    });
  }

  const atmosphereDotClass =
    atmosphere === 'good'
      ? 'bg-emerald-500'
      : atmosphere === 'moderate'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <section
      aria-label="Location and city search"
      className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-5 transition-colors duration-300"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--vm-accent-text)]">
            <span>
              Active Monitoring Zone · {formatLocationLabel(activeArea, activeCity, ' · ')}
            </span>
            <span aria-hidden="true" className="text-[var(--vm-ink-muted)]">·</span>
            <span
              data-testid="active-aqi-theme-label"
              className="inline-flex items-center gap-1.5 text-[var(--vm-ink-secondary)]"
            >
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${atmosphereDotClass}`} />
              <span>{atmosphereLabel} (NAQI {Math.round(activeAqi)})</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--vm-ink)] mt-1 text-balance">
            Navigate winter smog across your neighborhood
          </h1>
        </div>

        <div ref={wrapperRef} className="relative w-full lg:w-[520px] shrink-0">
          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <label htmlFor="city-search-input" className="sr-only">
              Search Indian city or area
            </label>
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-[var(--vm-ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                id="city-search-input"
                type="text"
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                  setSearchError(null);
                }}
                placeholder="Search Indian city or area..."
                className="w-full h-11 pl-10 pr-4 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] placeholder:text-[var(--vm-ink-muted)] focus:outline-none focus:bg-[var(--vm-surface)] focus:border-[var(--vm-accent-border)]"
              />
            </div>

            <button
              type="submit"
              disabled={isGeocoding || !query.trim()}
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
              }}
              className="h-11 px-4 text-sm font-semibold rounded-lg text-white hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-opacity whitespace-nowrap shrink-0"
            >
              {isGeocoding ? 'Searching...' : 'Check City'}
            </button>

            <button
              type="button"
              onClick={onDetectLocation}
              disabled={isLocating}
              aria-label="Detect my current location"
              className="h-11 px-3.5 text-sm font-medium rounded-lg border border-[var(--vm-border-strong)] bg-[var(--vm-muted)] text-[var(--vm-ink-secondary)] hover:bg-[var(--vm-muted-hover)] hover:text-[var(--vm-ink)] disabled:opacity-60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--vm-accent-text)]" />
              ) : (
                <LocateFixed className="w-4 h-4 text-[var(--vm-accent-text)]" />
              )}
              <span className="hidden sm:inline">Where We Are</span>
            </button>
          </form>

          {isOpen && (suggestions.length > 0 || isSuggesting) && (
            <ul
              role="listbox"
              aria-label="Location suggestions"
              className="absolute z-30 left-0 right-0 mt-1.5 bg-[var(--vm-surface)] border border-[var(--vm-border-strong)] rounded-lg shadow-xl overflow-hidden divide-y divide-[var(--vm-border)]"
            >
              {isSuggesting && suggestions.length === 0 && (
                <li className="px-4 py-3 text-xs text-[var(--vm-ink-muted)]">
                  Finding places in India...
                </li>
              )}
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.placePrediction?.placeId || index}>
                  <button
                    type="button"
                    onClick={() => void handleSuggestionSelect(suggestion)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--vm-ink)] hover:bg-[var(--vm-muted)] transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{suggestion.placePrediction?.text.text}</span>
                    <span className="text-xs text-[var(--vm-accent-text)] shrink-0">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick-jump Indian cities + Auto AQI / Light / Dark Theme Switcher */}
      <div className="mt-4 pt-3.5 border-t border-[var(--vm-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--vm-ink-muted)] mr-1">Indian metros:</span>
          {INDIAN_CITY_PRESETS.map((preset) => {
            const isSelected = preset.city.toLowerCase() === activeCity.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset)}
                style={
                  isSelected
                    ? {
                        backgroundImage:
                          'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                      }
                    : undefined
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'text-white shadow-sm'
                    : 'bg-[var(--vm-muted)] text-[var(--vm-ink-secondary)] border border-[var(--vm-border-strong)] hover:bg-[var(--vm-muted-hover)] hover:text-[var(--vm-ink)]'
                }`}
              >
                {preset.city}
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Color theme"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] shrink-0"
        >
          <button
            type="button"
            aria-pressed={themeMode === 'auto'}
            onClick={() => onChangeThemeMode('auto')}
            style={
              themeMode === 'auto'
                ? {
                    backgroundImage:
                      'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                  }
                : undefined
            }
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              themeMode === 'auto'
                ? 'text-white shadow-sm'
                : 'text-[var(--vm-ink-secondary)] hover:text-[var(--vm-ink)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto (AQI)</span>
          </button>
          <button
            type="button"
            aria-pressed={themeMode === 'light'}
            onClick={() => onChangeThemeMode('light')}
            style={
              themeMode === 'light'
                ? {
                    backgroundImage:
                      'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                  }
                : undefined
            }
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              themeMode === 'light'
                ? 'text-white shadow-sm'
                : 'text-[var(--vm-ink-secondary)] hover:text-[var(--vm-ink)]'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
          <button
            type="button"
            aria-pressed={themeMode === 'dark'}
            onClick={() => onChangeThemeMode('dark')}
            style={
              themeMode === 'dark'
                ? {
                    backgroundImage:
                      'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                  }
                : undefined
            }
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              themeMode === 'dark'
                ? 'text-white shadow-sm'
                : 'text-[var(--vm-ink-secondary)] hover:text-[var(--vm-ink)]'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {(searchError || locationError) && (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-400">
          {searchError || locationError}
        </p>
      )}
    </section>
  );
}
