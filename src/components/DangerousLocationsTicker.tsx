import { AlertTriangle, MapPin } from 'lucide-react';
import { classifyIndianAqi, formatLocationLabel } from '../utils/airQualityLogic.ts';
import type { DangerousLocationAlert } from '../types/airQuality.ts';

interface DangerousLocationsTickerProps {
  alerts: DangerousLocationAlert[];
  isLoading: boolean;
  onSelectAlert: (alert: DangerousLocationAlert) => void;
}

function renderAlertItem(
  alert: DangerousLocationAlert,
  onSelectAlert: (alert: DangerousLocationAlert) => void,
  isClone: boolean
) {
  const cls = classifyIndianAqi(alert.aqi);
  const isSevere = alert.aqi > 400;
  const isVeryPoor = alert.aqi > 300 && alert.aqi <= 400;

  return (
    <button
      key={`${isClone ? 'clone' : 'live'}-${alert.id}`}
      type="button"
      tabIndex={isClone ? -1 : undefined}
      onClick={() => onSelectAlert(alert)}
      className="group inline-flex items-center gap-2.5 px-3 py-1.5 mx-1.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/75 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/70 hover:border-red-400 dark:hover:border-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full shrink-0 ${
          isSevere
            ? 'bg-rose-600 dark:bg-rose-400 animate-pulse'
            : isVeryPoor
              ? 'bg-red-600 dark:bg-red-400'
              : 'bg-orange-500 dark:bg-orange-400'
        }`}
      />
      <span className="text-xs font-semibold text-[#1C0F0C] dark:text-[#FFF6F0] group-hover:underline">
        {formatLocationLabel(alert.areaName, alert.city)}
      </span>
      <span
        className={`font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${cls.badgeBgClass} ${cls.badgeTextClass} border ${cls.borderClass}`}
      >
        NAQI {alert.aqi}
      </span>
      <span className="text-[11px] font-medium text-red-800 dark:text-red-200">
        {alert.band}
      </span>
      <MapPin
        aria-hidden="true"
        className="w-3 h-3 text-red-600 dark:text-red-400 opacity-70 group-hover:opacity-100"
      />
    </button>
  );
}

export function DangerousLocationsTicker({
  alerts,
  isLoading,
  onSelectAlert,
}: DangerousLocationsTickerProps) {
  if (!isLoading && alerts.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Dangerous air quality status locations"
      data-testid="dangerous-locations-ticker"
      className="bg-[var(--vm-surface)] border border-red-300/80 dark:border-red-800/70 rounded-xl overflow-hidden flex flex-col sm:flex-row sm:items-center shadow-sm"
    >
      <div className="relative z-10 px-4 py-2.5 bg-gradient-to-r from-rose-700 via-red-600 to-orange-600 text-white flex items-center justify-between sm:justify-start gap-2.5 shrink-0 shadow-[4px_0_12px_rgba(0,0,0,0.14)]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
            Dangerous AQI Zones
          </span>
        </div>
        {alerts.length > 0 && (
          <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-black/25 text-amber-100 tabular-nums whitespace-nowrap">
            {alerts.length} alerts &gt; 200
          </span>
        )}
      </div>

      <div className="relative flex-1 min-w-0 overflow-hidden py-2 px-1 vm-marquee-container">
        {isLoading && alerts.length === 0 ? (
          <div className="px-4 py-1 text-xs text-[var(--vm-ink-muted)]">
            Scanning Indian monitoring corridors for Poor, Very Poor &amp; Severe AQI alerts...
          </div>
        ) : (
          <div className="vm-marquee-track items-center">
            <div className="flex items-center shrink-0">
              {alerts.map((alert) => renderAlertItem(alert, onSelectAlert, false))}
            </div>
            <div aria-hidden="true" className="flex items-center shrink-0">
              {alerts.map((alert) => renderAlertItem(alert, onSelectAlert, true))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
