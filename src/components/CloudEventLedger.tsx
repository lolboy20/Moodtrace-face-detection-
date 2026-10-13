import React, { useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { EmotionType, TelemetryLogEntry } from '../types/telemetry';
import { EMOTION_COLORS, EMOTION_LABELS } from '../utils/emotionEngine';

interface Props {
  logs: TelemetryLogEntry[];
  onExportCsv: () => void;
  onResetCloudDb: () => Promise<void>;
  onCaptureManualSnapshot: () => void;
  theme?: 'light' | 'dark';
}

const FILTER_OPTIONS: Array<{ id: 'all' | 'alerts' | EmotionType; label: string }> = [
  { id: 'all', label: 'All Frames' },
  { id: 'alerts', label: 'Alert Triggered' },
  { id: 'focus', label: 'Focus' },
  { id: 'joy', label: 'Joy' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'anger', label: 'Anger' },
  { id: 'sadness', label: 'Sadness' },
  { id: 'surprise', label: 'Surprise' },
  { id: 'fear', label: 'Fear' },
  { id: 'disgust', label: 'Disgust' },
];

export const CloudEventLedger: React.FC<Props> = ({
  logs,
  onExportCsv,
  onResetCloudDb,
  onCaptureManualSnapshot,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [emotionFilter, setEmotionFilter] = useState<'all' | 'alerts' | EmotionType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (emotionFilter === 'alerts') {
        if (!entry.triggeredAlertIds || entry.triggeredAlertIds.length === 0) return false;
      } else if (emotionFilter !== 'all') {
        if (entry.dominantEmotion !== emotionFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmotion = EMOTION_LABELS[entry.dominantEmotion].toLowerCase().includes(q);
        const matchSubject = entry.subjectLabel.toLowerCase().includes(q);
        const matchId = entry.id.toLowerCase().includes(q);
        return matchEmotion || matchSubject || matchId;
      }
      return true;
    });
  }, [logs, emotionFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div>
          <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            Cloud Biometric Telemetry Ledger
          </h2>
          <p className={`text-xs mt-0.5 font-mono tabular-nums ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            PERSISTED FRAMES: {logs.length} · FILTERED MATCHES: {filteredLogs.length} · SYNC: REST /API/TELEMETRY/LOGS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCaptureManualSnapshot}
            className="px-3.5 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Log Instant Snapshot
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isLight
                ? 'border-slate-300 text-slate-800 hover:bg-slate-50'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onResetCloudDb}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isLight
                ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-slate-50'
                : 'border-slate-800 text-slate-400 hover:text-rose-400 hover:border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`flex flex-wrap items-center gap-1 p-1 border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0F141F] border-slate-800'
        }`}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setEmotionFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                emotionFilter === opt.id
                  ? isLight
                    ? 'bg-white text-slate-950 font-semibold shadow-xs'
                    : 'bg-cyan-500 text-slate-950 font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by emotion, subject, or frame ID..."
            className={`w-full pl-8 pr-3 py-1.5 text-xs border focus:outline-none focus:border-cyan-500 ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                : 'bg-[#0F141F] border-slate-800 text-slate-200 placeholder:text-slate-500'
            }`}
          />
        </div>
      </div>

      <div className={`border overflow-hidden ${
        isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0F141F]'
      }`}>
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              NO CLOUD TELEMETRY RECORDS MATCHING ACTIVE FILTER CRITERIA.
            </p>
            <button
              type="button"
              onClick={() => {
                setEmotionFilter('all');
                setSearchQuery('');
              }}
              className={`px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-100 text-cyan-800 hover:bg-slate-200'
                  : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
              }`}
            >
              Clear Active Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left border-collapse">
              <thead className={`sticky top-0 border-b text-[11px] font-mono uppercase z-10 ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : 'bg-[#0B0F17] border-slate-800 text-slate-400'
              }`}>
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Source</th>
                  <th className="py-2.5 px-4">Dominant Emotion</th>
                  <th className="py-2.5 px-4 text-right">Confidence</th>
                  <th className="py-2.5 px-4 text-right">Valence</th>
                  <th className="py-2.5 px-4 text-right">Arousal</th>
                  <th className="py-2.5 px-4 text-right">rPPG BPM</th>
                  <th className="py-2.5 px-4">FACS Action Units (AU01 · AU04 · AU06 · AU12 · AU15)</th>
                  <th className="py-2.5 px-4 text-right">Alerts</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-mono tabular-nums ${
                isLight ? 'divide-slate-100' : 'divide-slate-800/60'
              }`}>
                {filteredLogs.map((entry) => {
                  const hasAlerts = entry.triggeredAlertIds && entry.triggeredAlertIds.length > 0;
                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isLight
                          ? hasAlerts
                            ? 'bg-rose-50 hover:bg-rose-100/60'
                            : 'hover:bg-slate-50'
                          : hasAlerts
                            ? 'bg-rose-950/10 hover:bg-slate-800/40'
                            : 'hover:bg-slate-800/35'
                      }`}
                    >
                      <td className={`py-2.5 px-4 whitespace-nowrap ${
                        isLight ? 'text-slate-800' : 'text-slate-300'
                      }`}>
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className={`py-2.5 px-4 whitespace-nowrap ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {entry.sourceMode === 'optical_camera' ? 'OPTICAL CAM' : 'SYNTHETIC'}
                      </td>
                      <td
                        className="py-2.5 px-4 font-semibold whitespace-nowrap"
                        style={{ color: EMOTION_COLORS[entry.dominantEmotion] }}
                      >
                        {EMOTION_LABELS[entry.dominantEmotion]}
                      </td>
                      <td className={`py-2.5 px-4 text-right whitespace-nowrap font-medium ${
                        isLight ? 'text-slate-900' : 'text-slate-200'
                      }`}>
                        {entry.confidence.toFixed(1)}%
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right whitespace-nowrap font-medium ${
                          entry.valence >= 0
                            ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                            : isLight ? 'text-rose-700' : 'text-rose-400'
                        }`}
                      >
                        {entry.valence >= 0 ? `+${entry.valence.toFixed(2)}` : entry.valence.toFixed(2)}
                      </td>
                      <td className={`py-2.5 px-4 text-right whitespace-nowrap font-medium ${
                        isLight ? 'text-amber-700' : 'text-amber-300'
                      }`}>
                        {entry.arousal.toFixed(2)}
                      </td>
                      <td className={`py-2.5 px-4 text-right whitespace-nowrap ${
                        isLight ? 'text-slate-800' : 'text-slate-300'
                      }`}>
                        {entry.heartRateEstBpm} BPM
                      </td>
                      <td className={`py-2.5 px-4 whitespace-nowrap ${
                        isLight ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        <span>AU01:{entry.actionUnits.AU01_InnerBrowRaiser}%</span>
                        <span className={`mx-1.5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>·</span>
                        <span>AU04:{entry.actionUnits.AU04_BrowLowerer}%</span>
                        <span className={`mx-1.5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>·</span>
                        <span>AU06:{entry.actionUnits.AU06_CheekRaiser}%</span>
                        <span className={`mx-1.5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>·</span>
                        <span>AU12:{entry.actionUnits.AU12_LipCornerPuller}%</span>
                        <span className={`mx-1.5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>·</span>
                        <span>AU15:{entry.actionUnits.AU15_LipCornerDepressor}%</span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {hasAlerts ? (
                          <span className={`font-semibold ${
                            isLight ? 'text-rose-700' : 'text-rose-400'
                          }`}>
                            ✖ {entry.triggeredAlertIds.length} RULE
                          </span>
                        ) : (
                          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>● NOMINAL</span>
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
