import React, { useState } from 'react';
import {
  Bell,
  Check,
  Plus,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import type {
  AlertConditionMetric,
  AlertIncident,
  MoodAlertRule,
} from '../types/telemetry';
import { EMOTION_COLORS, EMOTION_LABELS, METRIC_LABELS } from '../utils/emotionEngine';

interface Props {
  rules: MoodAlertRule[];
  incidents: AlertIncident[];
  onSaveRule: (rule: MoodAlertRule) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onAcknowledgeIncident: (id: string) => Promise<void>;
  onAcknowledgeAll: () => Promise<void>;
  onSimulateRuleTrigger: (rule: MoodAlertRule) => void;
  theme?: 'light' | 'dark';
}

export const MoodAlertRuleManager: React.FC<Props> = ({
  rules,
  incidents,
  onSaveRule,
  onDeleteRule,
  onAcknowledgeIncident,
  onAcknowledgeAll,
  onSimulateRuleTrigger,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState<AlertConditionMetric>('anger');
  const [operator, setOperator] = useState<'gte' | 'lte'>('gte');
  const [threshold, setThreshold] = useState<number>(50);
  const [sustainedSamples, setSustainedSamples] = useState<number>(3);
  const [severity, setSeverity] = useState<'advisory' | 'warning' | 'critical'>('warning');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoSnapshot, setAutoSnapshot] = useState<boolean>(true);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRule: MoodAlertRule = {
      id: `rule-${Date.now()}`,
      name: name.trim(),
      description:
        description.trim() ||
        `Triggers ${severity} alert when ${METRIC_LABELS[metric]} is ${operator === 'gte' ? '>=' : '<='} ${threshold}% for ${sustainedSamples} consecutive samples.`,
      metric,
      operator,
      threshold: Number(threshold),
      sustainedSamples: Number(sustainedSamples),
      severity,
      soundEnabled,
      autoSnapshot,
      enabled: true,
      triggerCount: 0,
      lastTriggeredAt: null,
    };

    await onSaveRule(newRule);
    setName('');
    setDescription('');
    setIsCreating(false);
  };

  const toggleRuleEnabled = async (rule: MoodAlertRule) => {
    await onSaveRule({ ...rule, enabled: !rule.enabled });
  };

  const toggleRuleSound = async (rule: MoodAlertRule) => {
    await onSaveRule({ ...rule, soundEnabled: !rule.soundEnabled });
  };

  const unacknowledgedCount = incidents.filter((i) => !i.acknowledged).length;

  return (
    <div className="space-y-8">
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div>
          <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            Customizable Mood Pattern Alert Rules
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Configure real-time biometric thresholds, sustained sample windows, and acoustic notifications for specific emotional patterns.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreating ? 'Cancel Rule Builder' : 'New Mood Alert Rule'}</span>
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className={`border p-5 space-y-4 ${
            isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0F141F]'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-3 ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}>
            <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Define New Biometric Pattern Rule
            </h3>
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              REAL-TIME STREAM EVALUATOR
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Rule Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sustained Cognitive Overload"
                className={`w-full px-3 py-2 text-sm border focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#080B11] border-slate-800 text-slate-100'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Target Emotion / Affect Metric
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as AlertConditionMetric)}
                className={`w-full px-3 py-2 text-sm border focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#080B11] border-slate-800 text-slate-100'
                }`}
              >
                {(Object.keys(METRIC_LABELS) as AlertConditionMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {METRIC_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Comparison
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as 'gte' | 'lte')}
                  className={`w-full px-3 py-2 text-sm font-mono border focus:outline-none focus:border-cyan-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#080B11] border-slate-800 text-slate-100'
                  }`}
                >
                  <option value="gte">&gt;= (At or Above)</option>
                  <option value="lte">&lt;= (At or Below)</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Threshold (%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={99}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums border focus:outline-none focus:border-cyan-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#080B11] border-slate-800 text-slate-100'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Sustained Window (Consecutive Samples)
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={sustainedSamples}
                onChange={(e) => setSustainedSamples(Number(e.target.value))}
                className={`w-full px-3 py-2 text-sm font-mono tabular-nums border focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#080B11] border-slate-800 text-slate-100'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Alert Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as 'advisory' | 'warning' | 'critical')
                }
                className={`w-full px-3 py-2 text-sm border focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#080B11] border-slate-800 text-slate-100'
                }`}
              >
                <option value="advisory">Advisory (Emerald / Cyan)</option>
                <option value="warning">Warning (Telemetry Amber)</option>
                <option value="critical">Critical Intervention (Crimson)</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Clinical / Operational Note
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context for cloud incident log"
                className={`w-full px-3 py-2 text-sm border focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#080B11] border-slate-800 text-slate-100'
                }`}
              />
            </div>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-4 pt-3 border-t ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}>
            <div className={`flex items-center gap-6 text-xs ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="accent-cyan-500"
                />
                <span>Play Acoustic Chime on Trigger</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSnapshot}
                  onChange={(e) => setAutoSnapshot(e.target.checked)}
                  className="accent-cyan-500"
                />
                <span>Force Cloud Telemetry Snapshot</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className={`px-4 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer"
              >
                Save & Activate Rule
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rules.map((rule) => {
          const severityText =
            rule.severity === 'critical'
              ? '✖ CRITICAL'
              : rule.severity === 'warning'
              ? '▲ WARNING'
              : '● ADVISORY';
          const severityColor =
            rule.severity === 'critical'
              ? isLight ? 'text-rose-700 font-semibold' : 'text-rose-400'
              : rule.severity === 'warning'
              ? isLight ? 'text-amber-700 font-semibold' : 'text-amber-400'
              : isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400';

          return (
            <div
              key={rule.id}
              className={`border p-5 transition-colors ${
                rule.enabled
                  ? isLight
                    ? 'border-slate-200 bg-white shadow-xs'
                    : 'border-slate-800 bg-[#0F141F]'
                  : isLight
                    ? 'border-slate-200 bg-slate-50 opacity-60'
                    : 'border-slate-900 bg-[#0A0E16] opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className={severityColor}>{severityText}</span>
                  <span className={isLight ? 'text-slate-300' : 'text-slate-600'} aria-hidden="true">·</span>
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                    {rule.enabled ? 'ACTIVE MONITOR' : 'PAUSED'}
                  </span>
                  <span className={isLight ? 'text-slate-300' : 'text-slate-600'} aria-hidden="true">·</span>
                  <span className={`tabular-nums ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    TRIGGERS: {rule.triggerCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRuleSound(rule)}
                    title={rule.soundEnabled ? 'Mute acoustic chime' : 'Enable acoustic chime'}
                    className={`p-1.5 border transition-colors cursor-pointer ${
                      isLight
                        ? 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {rule.soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    title="Delete rule"
                    className={`p-1.5 border transition-colors cursor-pointer ${
                      isLight
                        ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-slate-50'
                        : 'border-slate-800 text-slate-400 hover:text-rose-400 hover:border-slate-700'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className={`text-base font-semibold mt-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {rule.name}
              </h3>
              <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {rule.description}
              </p>

              <div className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-3 ${
                isLight ? 'border-slate-100' : 'border-slate-800/80'
              }`}>
                <div className={`text-xs font-mono tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <span>CONDITION: {METRIC_LABELS[rule.metric].toUpperCase()}</span>
                  <span className={`mx-1.5 font-semibold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                    {rule.operator === 'gte' ? '>=' : '<='} {rule.threshold}%
                  </span>
                  <span className={isLight ? 'text-slate-300' : 'text-slate-500'}>·</span>
                  <span className={`ml-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    WINDOW: {rule.sustainedSamples} SAMPLES
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSimulateRuleTrigger(rule)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isLight
                        ? 'bg-slate-100 text-cyan-800 hover:bg-slate-200'
                        : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    <span>Test Pattern</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRuleEnabled(rule)}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      rule.enabled
                        ? isLight
                          ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : isLight
                          ? 'border-cyan-600 text-cyan-700 hover:bg-cyan-50'
                          : 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-950/40'
                    }`}
                  >
                    {rule.enabled ? 'Pause Rule' : 'Enable Rule'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0F141F]'}`}>
        <div className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div>
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}>
              <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Triggered Mood Pattern Incidents</span>
            </h3>
            <p className={`text-xs mt-0.5 font-mono tabular-nums ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              TOTAL INCIDENTS: {incidents.length} · UNACKNOWLEDGED: {unacknowledgedCount}
            </p>
          </div>

          {unacknowledgedCount > 0 && (
            <button
              type="button"
              onClick={onAcknowledgeAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isLight
                  ? 'border-slate-300 text-slate-800 hover:bg-slate-50'
                  : 'border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Acknowledge All ({unacknowledgedCount})</span>
            </button>
          )}
        </div>

        {incidents.length === 0 ? (
          <div className={`p-8 text-center text-xs font-mono ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`}>
            NO MOOD PATTERN INCIDENTS RECORDED IN CURRENT CLOUD SESSION.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-mono uppercase ${
                  isLight
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-slate-800 bg-[#0B0F17] text-slate-400'
                }`}>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Triggered Rule</th>
                  <th className="py-2.5 px-4 text-right">Measured vs Limit</th>
                  <th className="py-2.5 px-4">Dominant Affect</th>
                  <th className="py-2.5 px-4 text-right">Valence / Arousal</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs ${
                isLight ? 'divide-slate-100' : 'divide-slate-800/70'
              }`}>
                {incidents.map((inc) => {
                  const sevText =
                    inc.severity === 'critical'
                      ? '✖ CRITICAL'
                      : inc.severity === 'warning'
                      ? '▲ WARNING'
                      : '● ADVISORY';
                  const sevColor =
                    inc.severity === 'critical'
                      ? isLight ? 'text-rose-700 font-semibold' : 'text-rose-400'
                      : inc.severity === 'warning'
                      ? isLight ? 'text-amber-700 font-semibold' : 'text-amber-400'
                      : isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400';

                  return (
                    <tr
                      key={inc.id}
                      className={`transition-colors ${
                        isLight
                          ? !inc.acknowledged
                            ? 'bg-rose-50 hover:bg-rose-100/60'
                            : 'hover:bg-slate-50'
                          : !inc.acknowledged
                            ? 'bg-rose-950/10 hover:bg-slate-800/40'
                            : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className={`py-2.5 px-4 font-mono tabular-nums whitespace-nowrap ${
                        isLight ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        {new Date(inc.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className={`py-2.5 px-4 font-mono whitespace-nowrap ${sevColor}`}>
                        {sevText}
                      </td>
                      <td className={`py-2.5 px-4 font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                        <div>{inc.ruleName}</div>
                        {inc.notes && (
                          <div className={`text-[11px] font-normal mt-0.5 ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {inc.notes}
                          </div>
                        )}
                      </td>
                      <td className={`py-2.5 px-4 font-mono tabular-nums text-right whitespace-nowrap ${
                        isLight ? 'text-slate-900' : 'text-slate-200'
                      }`}>
                        <span className={`font-semibold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                          {inc.measuredValue.toFixed(1)}%
                        </span>
                        <span className={`mx-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>/</span>
                        <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{inc.thresholdValue}%</span>
                      </td>
                      <td
                        className="py-2.5 px-4 font-mono whitespace-nowrap font-medium"
                        style={{ color: EMOTION_COLORS[inc.dominantEmotion] }}
                      >
                        {EMOTION_LABELS[inc.dominantEmotion]}
                      </td>
                      <td className={`py-2.5 px-4 font-mono tabular-nums text-right whitespace-nowrap ${
                        isLight ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        {inc.valence >= 0 ? `+${inc.valence.toFixed(2)}` : inc.valence.toFixed(2)}{' '}
                        / {inc.arousal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {inc.acknowledged ? (
                          <span className={`font-mono text-[11px] ${
                            isLight ? 'text-slate-500' : 'text-slate-500'
                          }`}>
                            ACKNOWLEDGED
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAcknowledgeIncident(inc.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                              isLight
                                ? 'border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100'
                                : 'border-amber-500/40 text-amber-300 hover:bg-amber-950/40'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
