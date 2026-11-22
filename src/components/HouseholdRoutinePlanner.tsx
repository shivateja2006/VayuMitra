import { useState } from 'react';
import { Check, Leaf, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { calculateChoiceImpact, formatLocationLabel } from '../utils/airQualityLogic.ts';
import type {
  ActionCategory,
  HouseholdProfile,
  SensitiveGroup,
  TailoredPlanResponse,
} from '../types/airQuality.ts';

interface HouseholdRoutinePlannerProps {
  city: string;
  area: string;
  aqi: number;
  profile: HouseholdProfile;
  plan: TailoredPlanResponse | null;
  adoptedIds: string[];
  isGenerating: boolean;
  planError: string | null;
  onUpdateProfile: (next: HouseholdProfile) => void;
  onGeneratePlan: () => void;
  onToggleAction: (actionId: string) => void;
}

const SENSITIVE_OPTIONS: Array<{ id: SensitiveGroup; label: string }> = [
  { id: 'children', label: 'Young Children' },
  { id: 'elderly', label: 'Seniors (60+)' },
  { id: 'asthma', label: 'Asthma / Respiratory' },
  { id: 'athletes', label: 'Outdoor Runners' },
];

const CATEGORY_LABELS: Record<'all' | ActionCategory, string> = {
  all: 'All',
  routine: 'Routines',
  indoor_hack: 'Indoor Hacks',
  sustainable_alt: 'Alternatives',
};

export function HouseholdRoutinePlanner({
  city,
  area,
  aqi,
  profile,
  plan,
  adoptedIds,
  isGenerating,
  planError,
  onUpdateProfile,
  onGeneratePlan,
  onToggleAction,
}: HouseholdRoutinePlannerProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ActionCategory>('all');

  const actions = plan?.actions || [];
  const filteredActions =
    categoryFilter === 'all'
      ? actions
      : actions.filter((a) => a.category === categoryFilter);

  const impact = calculateChoiceImpact(actions, adoptedIds);

  function toggleSensitiveGroup(group: SensitiveGroup) {
    const exists = profile.sensitiveGroups.includes(group);
    const nextGroups = exists
      ? profile.sensitiveGroups.filter((g) => g !== group)
      : [...profile.sensitiveGroups, group];
    onUpdateProfile({ ...profile, sensitiveGroups: nextGroups });
  }

  return (
    <section id="daily-plan" className="space-y-6">
      <div
        id="routine-planner"
        className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-5 sm:p-6 transition-colors duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--vm-border)]">
          <div>
            <p className="text-xs font-medium text-[var(--vm-accent-text)]">
              Tailored Action Engine · {formatLocationLabel(area, city)} (NAQI {aqi})
            </p>
            <h2 className="text-xl font-bold text-[var(--vm-ink)] mt-1">
              Household Routine, Indoor Hacks &amp; Choice Impact
            </h2>
          </div>

          <button
            type="button"
            onClick={onGeneratePlan}
            disabled={isGenerating}
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
            }}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg text-white hover:opacity-95 disabled:opacity-60 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0 self-start lg:self-auto shadow-sm"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGenerating ? 'Personalizing Plan...' : 'Generate Tailored Plan'}</span>
          </button>
        </div>

        {/* Household & Lifestyle Controls */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <fieldset className="md:col-span-2 lg:col-span-4">
            <legend className="text-xs font-semibold text-[var(--vm-ink-secondary)] mb-2">
              Family Sensitivity Profile
            </legend>
            <div className="flex flex-wrap gap-2">
              {SENSITIVE_OPTIONS.map((opt) => {
                const active = profile.sensitiveGroups.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSensitiveGroup(opt.id)}
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--vm-accent-soft)',
                            borderColor: 'var(--vm-accent-border)',
                          }
                        : undefined
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      active
                        ? 'text-[var(--vm-ink)] font-semibold'
                        : 'bg-[var(--vm-muted)] border-[var(--vm-border-strong)] text-[var(--vm-ink-secondary)] hover:bg-[var(--vm-muted-hover)] hover:text-[var(--vm-ink)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="commute-mode"
              className="block text-xs font-semibold text-[var(--vm-ink-secondary)] mb-1.5"
            >
              Daily Commute
            </label>
            <select
              id="commute-mode"
              value={profile.commuteMode}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  commuteMode: e.target.value as HouseholdProfile['commuteMode'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] focus:outline-none focus:border-[var(--vm-accent-border)]"
            >
              <option value="car_two_wheeler">Car / Two-Wheeler</option>
              <option value="metro_bus">Metro / City Bus</option>
              <option value="walk_cycle">Walk / Cycle</option>
              <option value="remote">Work / Study From Home</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="home-type"
              className="block text-xs font-semibold text-[var(--vm-ink-secondary)] mb-1.5"
            >
              Home Setup
            </label>
            <select
              id="home-type"
              value={profile.homeType}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  homeType: e.target.value as HouseholdProfile['homeType'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] focus:outline-none focus:border-[var(--vm-accent-border)]"
            >
              <option value="apartment_highrise">Apartment / High-Rise</option>
              <option value="ground_floor_roadside">Ground Floor / Near Main Road</option>
              <option value="independent_house">Independent House / Courtyard</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cooking-fuel"
              className="block text-xs font-semibold text-[var(--vm-ink-secondary)] mb-1.5"
            >
              Kitchen Fuel
            </label>
            <select
              id="cooking-fuel"
              value={profile.cookingFuel}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  cookingFuel: e.target.value as HouseholdProfile['cookingFuel'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] focus:outline-none focus:border-[var(--vm-accent-border)]"
            >
              <option value="lpg">LPG Cylinder / Piped Gas</option>
              <option value="induction">Electric Induction</option>
              <option value="mixed_biomass">Mixed / Solid Fuel / Tandoor</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="primary-goal"
              className="block text-xs font-semibold text-[var(--vm-ink-secondary)] mb-1.5"
            >
              Primary Priority
            </label>
            <select
              id="primary-goal"
              value={profile.primaryGoal}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  primaryGoal: e.target.value as HouseholdProfile['primaryGoal'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] focus:outline-none focus:border-[var(--vm-accent-border)]"
            >
              <option value="protect_indoor">Protect Indoor Air Quality</option>
              <option value="safe_commute">Safer School &amp; Work Commute</option>
              <option value="reduce_emissions">Cut Household Emissions</option>
              <option value="community_action">Neighborhood / RWA Action</option>
            </select>
          </div>
        </div>

        {planError && (
          <div
            role="alert"
            className="mt-4 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-700/60 text-xs text-red-900 dark:text-red-100"
          >
            <strong>AI Planner Notice:</strong> {planError} Showing CPCB baseline guidance below.
          </div>
        )}

        {/* Direct Impact Ledger & Collective Air Quality Impact Progress */}
        <div className="mt-6 pt-5 border-t border-[var(--vm-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[var(--vm-ink)]">
              Direct Impact of Your Adopted Choices
            </h3>
            <span className="text-xs text-[var(--vm-ink-muted)] font-mono tabular-nums">
              {impact.adoptedCount} of {impact.totalCount} routines adopted
            </span>
          </div>

          {/* Collective Air Quality Impact Score Progress Bar */}
          <div className="bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-[var(--vm-ink)]">
                  Collective Air Quality Impact Score
                </span>
                <span aria-hidden="true" className="text-xs text-[var(--vm-ink-muted)]">·</span>
                <span
                  data-testid="collective-impact-tier"
                  className="text-xs font-medium text-[var(--vm-accent-text)]"
                >
                  {impact.collectiveImpactTier}
                </span>
              </div>
              <span
                data-testid="collective-impact-score"
                className="font-mono text-lg font-bold text-[var(--vm-ink)] tabular-nums"
              >
                {impact.collectiveImpactScore}{' '}
                <span className="text-xs font-normal text-[var(--vm-ink-muted)]">/ 100</span>
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Collective air quality impact score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={impact.collectiveImpactScore}
              data-score={impact.collectiveImpactScore}
              style={{ backgroundColor: 'var(--vm-track-bg)' }}
              className="h-3.5 w-full rounded-full border border-[var(--vm-border-strong)] overflow-hidden p-0.5"
            >
              <div
                data-testid="collective-impact-bar"
                style={{
                  transform: `scaleX(${impact.collectiveImpactScore / 100})`,
                  backgroundImage:
                    'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-mid), var(--vm-accent-to))',
                }}
                className="h-full w-full origin-left rounded-full transition-transform duration-300 ease-out"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-[var(--vm-ink-muted)] tabular-nums">
              <span>0 · Starter</span>
              <span className="hidden sm:inline">30 · Building Momentum</span>
              <span>60 · High Impact</span>
              <span>100 · Max Protection</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--vm-muted)] border border-[var(--vm-border)] rounded-lg p-4">
              <p className="text-xs font-medium text-[var(--vm-ink-muted)]">
                Personal PM2.5 Exposure Reduced
              </p>
              <p
                data-testid="impact-exposure-pct"
                className="font-mono text-2xl font-bold text-[var(--vm-accent-text)] tabular-nums mt-1"
              >
                {impact.personalExposureReductionPct}%
              </p>
              <p className="text-xs text-[var(--vm-ink-secondary)] mt-1">
                Lowered inhaled particulate load across indoor and commute hours.
              </p>
            </div>

            <div className="bg-[var(--vm-muted)] border border-[var(--vm-border)] rounded-lg p-4">
              <p className="text-xs font-medium text-[var(--vm-ink-muted)]">
                Weekly Emissions Avoided
              </p>
              <p
                data-testid="impact-co2-kg"
                className="font-mono text-2xl font-bold text-[var(--vm-ink)] tabular-nums mt-1"
              >
                {impact.weeklyCo2SavedKg} kg CO₂e
              </p>
              <p className="text-xs text-[var(--vm-ink-secondary)] mt-1">
                Direct greenhouse gas reduction from cleaner transit and fuel choices.
              </p>
            </div>

            <div className="bg-[var(--vm-muted)] border border-[var(--vm-border)] rounded-lg p-4">
              <p className="text-xs font-medium text-[var(--vm-ink-muted)]">
                Street-Level PM2.5 Prevented
              </p>
              <p
                data-testid="impact-pm25-g"
                className="font-mono text-2xl font-bold text-[var(--vm-accent-text)] tabular-nums mt-1"
              >
                {impact.weeklyPm25AvoidedGrams} g / week
              </p>
              <p className="text-xs text-[var(--vm-ink-secondary)] mt-1">
                Fine soot prevented from entering neighborhood air around {area}.
              </p>
            </div>
          </div>

          {impact.adoptedCount === 0 && actions.length > 0 && (
            <p className="text-xs text-[var(--vm-ink-muted)] mt-3">
              Check off routines below to raise your collective impact score and lower household exposure.
            </p>
          )}
        </div>

        {/* Plan Overview + Filter Tabs */}
        {plan && (
          <div className="mt-6 pt-5 border-t border-[var(--vm-border)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-[var(--vm-accent-text)]">
                  {plan.generatedBy !== 'baseline-guide'
                    ? 'Personalized by VayuMitra AI'
                    : 'CPCB Baseline Guidance'}{' '}
                  · Best Window: {plan.bestOutdoorWindow}
                </p>
                <h3 className="text-base font-bold text-[var(--vm-ink)] mt-0.5">
                  {plan.summaryHeadline}
                </h3>
                <p className="text-sm text-[var(--vm-ink-secondary)] mt-1 leading-relaxed">
                  {plan.whyThisMattersNow}
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter recommendations by category"
                className="flex flex-wrap items-center gap-1 p-1 bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg self-start"
              >
                {(['all', 'routine', 'indoor_hack', 'sustainable_alt'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={categoryFilter === cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={
                      categoryFilter === cat
                        ? {
                            backgroundImage:
                              'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                          }
                        : undefined
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      categoryFilter === cat
                        ? 'text-white shadow-sm'
                        : 'text-[var(--vm-ink-secondary)] hover:text-[var(--vm-ink)]'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActions.map((action) => {
                const adopted = adoptedIds.includes(action.id);
                return (
                  <div
                    key={action.id}
                    style={
                      adopted
                        ? {
                            backgroundColor: 'var(--vm-accent-soft)',
                            borderColor: 'var(--vm-accent-border)',
                          }
                        : undefined
                    }
                    className={`border rounded-xl p-5 transition-colors flex flex-col justify-between ${
                      adopted
                        ? ''
                        : 'border-[var(--vm-border)] bg-[var(--vm-surface-alt)] hover:border-[var(--vm-accent-border)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--vm-ink-muted)]">
                            {CATEGORY_LABELS[action.category]} · {action.timeWindow} · {action.costLevel}
                          </p>
                          <h4 className="text-base font-semibold text-[var(--vm-ink)] mt-1">
                            {action.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={adopted}
                          aria-label={`Adopt habit: ${action.title}`}
                          onClick={() => onToggleAction(action.id)}
                          style={
                            adopted
                              ? {
                                  backgroundImage:
                                    'linear-gradient(to bottom right, var(--vm-accent-from), var(--vm-accent-to))',
                                  borderColor: 'var(--vm-accent-border)',
                                }
                              : undefined
                          }
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            adopted
                              ? 'text-white'
                              : 'bg-[var(--vm-muted)] border-[var(--vm-border-strong)] text-transparent hover:border-[var(--vm-accent-border)]'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-sm text-[var(--vm-ink-secondary)] mt-2.5 leading-relaxed">
                        {action.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-[var(--vm-border)]">
                      <p className="text-xs font-semibold text-[var(--vm-accent-text)] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Direct Impact of Your Choice</span>
                      </p>
                      <p className="text-xs text-[var(--vm-ink-secondary)] mt-1 leading-relaxed">
                        {action.directImpactExplanation}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--vm-ink-muted)] tabular-nums">
                        <span>-{action.exposureReductionPct}% PM2.5 inhaled</span>
                        <span aria-hidden="true">·</span>
                        <span>{action.weeklyCo2SavedKg} kg CO₂e/wk saved</span>
                        <span aria-hidden="true">·</span>
                        <span>{action.weeklyPm25AvoidedGrams} g PM2.5 avoided</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Community Action Callout */}
            <div className="bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg p-4 flex items-start gap-3">
              <Leaf className="w-4 h-4 text-[var(--vm-accent-text)] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--vm-ink)]">
                  Neighborhood &amp; RWA Action
                </p>
                <p className="text-xs text-[var(--vm-ink-secondary)] mt-0.5 leading-relaxed">
                  {plan.communityTip}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
