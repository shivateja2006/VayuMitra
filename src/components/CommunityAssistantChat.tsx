import { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { formatLocationLabel } from '../utils/airQualityLogic.ts';
import type { ChatTurn, HouseholdProfile } from '../types/airQuality.ts';

interface CommunityAssistantChatProps {
  city: string;
  area: string;
  state: string;
  indianAqi: number;
  band: string;
  dominantPollutant: string;
  profile: HouseholdProfile;
}

const STARTER_QUESTIONS = [
  'Is a 7:30 AM school bus stop wait safe here today?',
  'How do I build a low-cost DIY box-fan air filter for a 1BHK?',
  'What happens if our society stops evening dry-leaf burning?',
];

export function CommunityAssistantChat({
  city,
  area,
  state,
  indianAqi,
  band,
  dominantPollutant,
  profile,
}: CommunityAssistantChatProps) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion(textToAsk: string) {
    const trimmed = textToAsk.trim();
    if (!trimmed || isAsking) return;

    setError(null);
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setQuestion('');
    setIsAsking(true);

    try {
      const res = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          location: { city, area, state },
          airQuality: { indianAqi, band, dominantPollutant },
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to reach VayuMitra assistant.');
        return;
      }

      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch {
      setError('Network error while asking VayuMitra.');
    } finally {
      setIsAsking(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(question);
  }

  return (
    <section
      id="ask-assistant"
      aria-label="Ask VayuMitra community assistant"
      className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl p-5 sm:p-6 transition-colors duration-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--vm-border)]">
        <div>
          <h2 className="text-lg font-bold text-[var(--vm-ink)]">Ask VayuMitra About Your Area</h2>
          <p className="text-xs text-[var(--vm-ink-muted)] mt-0.5">
            Grounded in {formatLocationLabel(area, city)} · NAQI {indianAqi} ({band}) · {dominantPollutant} dominant
          </p>
        </div>
      </div>

      {/* Quick Starter Prompts */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void submitQuestion(q)}
            disabled={isAsking}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] text-[var(--vm-ink-secondary)] hover:bg-[var(--vm-muted-hover)] hover:border-[var(--vm-accent-border)] hover:text-[var(--vm-ink)] transition-colors text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Conversation History */}
      {turns.length > 0 && (
        <div
          data-testid="assistant-chat-log"
          className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1"
        >
          {turns.map((turn) => (
            <div
              key={turn.id}
              style={
                turn.role === 'user'
                  ? {
                      backgroundImage:
                        'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                      color: 'var(--vm-user-bubble-text)',
                    }
                  : undefined
              }
              className={`rounded-lg p-3.5 text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'border border-[var(--vm-accent-border)] ml-auto max-w-2xl'
                  : 'bg-[var(--vm-muted)] border border-[var(--vm-border)] text-[var(--vm-ink)] max-w-3xl'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-[11px] font-semibold ${
                    turn.role === 'user' ? 'opacity-90' : 'text-[var(--vm-accent-text)]'
                  }`}
                >
                  {turn.role === 'user' ? 'Your Family Question' : 'VayuMitra Advisor'}
                </span>
                <span
                  className={`text-[11px] font-mono ${
                    turn.role === 'user' ? 'opacity-80' : 'text-[var(--vm-ink-muted)]'
                  }`}
                >
                  {turn.timestamp}
                </span>
              </div>
              <p className="whitespace-pre-line">{turn.text}</p>
            </div>
          ))}
          {isAsking && (
            <div className="bg-[var(--vm-muted)] border border-[var(--vm-border)] rounded-lg p-3.5 text-xs text-[var(--vm-ink-secondary)] flex items-center gap-2 max-w-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--vm-accent-text)]" />
              <span>Checking {area} smog dispersion &amp; safety options...</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}

      <form onSubmit={handleFormSubmit} className="mt-4 flex items-center gap-2">
        <label htmlFor="ask-assistant-input" className="sr-only">
          Ask a question about smog, indoor air quality, or daily routines
        </label>
        <input
          id="ask-assistant-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask about ${area}, masks, school commutes, or indoor filtration...`}
          className="flex-1 h-11 px-4 text-sm bg-[var(--vm-muted)] border border-[var(--vm-border-strong)] rounded-lg text-[var(--vm-ink)] placeholder:text-[var(--vm-ink-muted)] focus:outline-none focus:bg-[var(--vm-surface)] focus:border-[var(--vm-accent-border)]"
        />
        <button
          type="submit"
          disabled={isAsking || !question.trim()}
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
          }}
          className="h-11 px-4 text-sm font-semibold rounded-lg text-white hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Ask</span>
        </button>
      </form>
    </section>
  );
}
