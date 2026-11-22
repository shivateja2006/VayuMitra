import { Clock, ShieldAlert, Wind } from 'lucide-react';
import { classifyIndianAqi, formatLocationLabel } from '../utils/airQualityLogic.ts';
import type { AirQualitySnapshot, AreaProbeReading } from '../types/airQuality.ts';

interface AirQualityTelemetryProps {
  snapshot: AirQualitySnapshot | null;
  isLoading: boolean;
  selectedAreaId: string;
  onSelectArea: (area: AreaProbeReading) => void;
}

export function AirQualityTelemetry({
  snapshot,
  isLoading,
  selectedAreaId,
  onSelectArea,
}: AirQualityTelemetryProps) {
  if (isLoading && !snapshot) {
    return (
      <div className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-6 space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-[var(--vm-muted-hover)] rounded" />
        <div className="h-14 w-56 bg-[var(--vm-muted-hover)] rounded" />
        <div className="h-24 w-full bg-[var(--vm-muted)] rounded" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-6 text-sm text-[var(--vm-ink-secondary)]">
        Select an Indian city or allow location access to view live air quality telemetry.
      </div>
    );
  }

  const { classification } = snapshot;

  return (
    <div className="space-y-6">
      {/* Primary AQI Instrument Card */}
      <div className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-5 sm:p-6 transition-colors duration-300">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[var(--vm-ink-muted)]">
              {formatLocationLabel(snapshot.area, snapshot.city, ' · ')} · {snapshot.state} ·{' '}
              {snapshot.dataSource === 'google-live' || snapshot.dataSource === 'live-cams'
                ? 'Live Air Quality Feed'
                : 'Seasonal Baseline'}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span
                data-testid="primary-aqi-value"
                className={`font-mono text-5xl font-bold tracking-tight tabular-nums ${classification.textClass}`}
              >
                {snapshot.indianAqi}
              </span>
              <div className="flex flex-col">
                <span
                  data-testid="primary-aqi-band"
                  className={`inline-block text-sm font-semibold px-2.5 py-0.5 rounded border ${classification.badgeBgClass} ${classification.badgeTextClass} ${classification.borderClass}`}
                >
                  {classification.band} · India NAQI
                </span>
                {snapshot.universalIndex && (
                  <span className="text-xs text-[var(--vm-ink-muted)] mt-1 font-mono tabular-nums">
                    Universal AQI: {snapshot.universalIndex.aqi}/100 ({snapshot.universalIndex.category})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg px-4 py-3 min-w-[200px]">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--vm-ink-muted)]">
              <Clock className="w-3.5 h-3.5 text-[var(--vm-accent-text)]" />
              <span>Safest Outdoor Window</span>
            </div>
            <p className="text-sm font-semibold text-[var(--vm-ink)] mt-1">
              {classification.bestWindow}
            </p>
            <p className="text-xs text-[var(--vm-ink-muted)] mt-0.5 font-mono">
              Dominant: {snapshot.dominantPollutant}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[var(--vm-ink-secondary)] leading-relaxed">
          {classification.summary}
        </p>

        {/* Health Recommendations Grid */}
        <div className="mt-5 pt-5 border-t border-[var(--vm-border)] grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-[var(--vm-ink)] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--vm-accent-text)]" />
              <span>Children &amp; Seniors</span>
            </h3>
            <p className="text-xs text-[var(--vm-ink-secondary)] leading-relaxed">
              {snapshot.healthRecommendations.children ||
                snapshot.healthRecommendations.elderly ||
                classification.outdoorAdvice}
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-[var(--vm-ink)] flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-[var(--vm-accent-text)]" />
              <span>General &amp; Commuters</span>
            </h3>
            <p className="text-xs text-[var(--vm-ink-secondary)] leading-relaxed">
              {snapshot.healthRecommendations.generalPopulation || classification.outdoorAdvice}
            </p>
          </div>
        </div>

        {/* 24-Hour Trend Strip */}
        {snapshot.forecast.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--vm-border)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[var(--vm-ink)]">
                24-Hour Smog Dispersion Forecast (IST)
              </h3>
              <span className="text-xs text-[var(--vm-ink-muted)]">3-hour intervals</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {snapshot.forecast.map((pt) => {
                const ptCls = classifyIndianAqi(pt.aqi);
                return (
                  <div
                    key={pt.dateTime}
                    className="bg-[var(--vm-muted)] border border-[var(--vm-border)] rounded-lg px-1.5 py-2 text-center min-w-0"
                  >
                    <div className="text-[11px] font-mono text-[var(--vm-ink-muted)] tabular-nums">
                      {pt.label}
                    </div>
                    <div
                      className={`font-mono text-sm font-bold tabular-nums mt-0.5 ${ptCls.textClass}`}
                    >
                      {pt.aqi}
                    </div>
                    <div className="text-[10px] tracking-tight text-[var(--vm-ink-secondary)] leading-tight mt-0.5 truncate">
                      {ptCls.band}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Area-Wise Breakdown Table */}
      <div
        id="area-breakdown"
        className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl overflow-hidden transition-colors duration-300"
      >
        <div className="px-5 py-4 border-b border-[var(--vm-border)] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--vm-ink)]">
              Area-Wise Air Quality · {snapshot.city}
            </h2>
            <p className="text-xs text-[var(--vm-ink-muted)] mt-0.5">
              Select any neighborhood row to recenter the map and fetch live area conditions.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--vm-border)] bg-[var(--vm-muted)] text-xs font-medium text-[var(--vm-ink-muted)]">
                <th className="py-2.5 px-4">Area / Neighborhood</th>
                <th className="py-2.5 px-4">Zone Profile</th>
                <th className="py-2.5 px-4 text-right">India NAQI</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vm-border)] text-sm">
              {snapshot.areaBreakdown.map((area) => {
                const areaCls = classifyIndianAqi(area.aqi);
                const isActive = area.id === selectedAreaId || area.isPrimary;
                return (
                  <tr
                    key={area.id}
                    style={isActive ? { backgroundColor: 'var(--vm-accent-soft)' } : undefined}
                    className={`transition-colors ${
                      isActive ? '' : 'hover:bg-[var(--vm-muted)]'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-[var(--vm-ink)]">
                      {area.areaName}
                      {area.isLive && (
                        <span className="ml-2 text-[11px] font-normal text-[var(--vm-accent-text)]">
                          · Live
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[var(--vm-ink-muted)]">
                      {area.zoneType}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-semibold tabular-nums ${areaCls.textClass}`}
                    >
                      {area.aqi}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-[var(--vm-ink-secondary)]">
                      {area.band}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectArea(area)}
                        style={
                          isActive
                            ? {
                                backgroundImage:
                                  'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                              }
                            : undefined
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                          isActive
                            ? 'border-[var(--vm-accent-border)] text-white'
                            : 'border-[var(--vm-border-strong)] bg-[var(--vm-muted)] text-[var(--vm-ink-secondary)] hover:bg-[var(--vm-muted-hover)] hover:text-[var(--vm-ink)]'
                        }`}
                      >
                        {isActive ? 'Focused' : 'Inspect Live'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Measured Pollutants Breakdown */}
      {snapshot.pollutants.length > 0 && (
        <div className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-5 transition-colors duration-300">
          <h3 className="text-sm font-semibold text-[var(--vm-ink)]">
            Pollutant Concentrations &amp; Sources
          </h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {snapshot.pollutants.slice(0, 4).map((p) => (
              <div
                key={p.code}
                className="border border-[var(--vm-border)] rounded-lg p-3.5 bg-[var(--vm-muted)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--vm-ink)]">{p.displayName}</span>
                  <span className="font-mono text-sm font-bold text-[var(--vm-accent-text)] tabular-nums">
                    {p.value} {p.formattedUnit}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--vm-ink-muted)] mt-0.5">{p.safeLimit}</p>
                {p.sources && (
                  <p className="text-xs text-[var(--vm-ink-secondary)] mt-2 leading-relaxed line-clamp-2">
                    {p.sources}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
