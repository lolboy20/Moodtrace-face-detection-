import React, { useState } from 'react';
import type { EmotionScores, EmotionType, TelemetryLogEntry } from '../types/telemetry';
import { EMOTION_COLORS, EMOTION_LABELS } from '../utils/emotionEngine';

interface RadarProps {
  currentScores: EmotionScores;
  sessionMeanScores: EmotionScores;
  theme?: 'light' | 'dark';
}

const AXES: EmotionType[] = [
  'joy',
  'focus',
  'neutral',
  'surprise',
  'sadness',
  'anger',
  'fear',
  'disgust',
];

export const EmotionSpiderRadar: React.FC<RadarProps> = ({
  currentScores,
  sessionMeanScores,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const size = 280;
  const center = size / 2;
  const maxRadius = 92;
  const rings = [0.25, 0.5, 0.75, 1.0];

  const getPoint = (index: number, valuePercent: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    const normalized = Math.max(0.04, Math.min(1, valuePercent / 85));
    const r = normalized * maxRadius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const buildPolygonPoints = (scores: EmotionScores): string =>
    AXES.map((emo, idx) => getPoint(idx, scores[emo]).join(',')).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
      >
        {rings.map((ring) => {
          const pts = AXES.map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
            const r = ring * maxRadius;
            return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
          }).join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke={isLight ? '#E2E8F0' : '#1E293B'}
              strokeWidth="1"
            />
          );
        })}

        {AXES.map((emo, idx) => {
          const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
          const x2 = center + Math.cos(angle) * maxRadius;
          const y2 = center + Math.sin(angle) * maxRadius;
          const lx = center + Math.cos(angle) * (maxRadius + 26);
          const ly = center + Math.sin(angle) * (maxRadius + 18);

          return (
            <g key={emo}>
              <line
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke={isLight ? '#CBD5E1' : '#1E293B'}
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`font-mono text-[10px] font-semibold uppercase ${
                  isLight ? 'fill-slate-600' : 'fill-slate-400'
                }`}
              >
                {emo.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Cloud Session Mean Polygon (dashed slate) */}
        <polygon
          points={buildPolygonPoints(sessionMeanScores)}
          fill={isLight ? 'rgba(100, 116, 139, 0.12)' : 'rgba(148, 163, 184, 0.08)'}
          stroke={isLight ? '#475569' : '#64748B'}
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />

        {/* Current Live Frame Polygon (cyan phosphor) */}
        <polygon
          points={buildPolygonPoints(currentScores)}
          fill={isLight ? 'rgba(8, 145, 178, 0.22)' : 'rgba(6, 182, 212, 0.20)'}
          stroke={isLight ? '#0891B2' : '#06B6D4'}
          strokeWidth="2"
        />

        {AXES.map((emo, idx) => {
          const [px, py] = getPoint(idx, currentScores[emo]);
          return (
            <circle
              key={emo}
              cx={px}
              cy={py}
              r="3"
              fill={isLight ? '#0891B2' : '#06B6D4'}
              stroke={isLight ? '#FFFFFF' : '#080B11'}
              strokeWidth="1"
            />
          );
        })}
      </svg>

      <div className={`mt-2 flex items-center gap-4 text-xs font-mono ${
        isLight ? 'text-slate-600' : 'text-slate-400'
      }`}>
        <span className={isLight ? 'text-cyan-700 font-semibold' : 'text-cyan-400'}>SOLID: LIVE VECTOR</span>
        <span aria-hidden="true">·</span>
        <span>DASHED: CLOUD MEAN</span>
      </div>
    </div>
  );
};

interface TimeSeriesProps {
  logs: TelemetryLogEntry[];
  theme?: 'light' | 'dark';
}

export const TelemetryWaveChart: React.FC<TimeSeriesProps> = ({ logs, theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chronological = [...logs].slice(0, 40).reverse();
  const width = 760;
  const height = 210;
  const padLeft = 40;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 26;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  if (chronological.length < 2) {
    return (
      <div className={`h-48 flex items-center justify-center border text-xs font-mono ${
        isLight
          ? 'border-slate-200 bg-slate-50 text-slate-500'
          : 'border-slate-800 bg-[#0B0F17] text-slate-400'
      }`}>
        AWAITING MULTI-SAMPLE TELEMETRY STREAM...
      </div>
    );
  }

  const getX = (i: number) =>
    padLeft + (i / Math.max(1, chronological.length - 1)) * innerW;

  const getValenceY = (v: number) => padTop + ((1 - (v + 1) / 2) * innerH);
  const getArousalY = (a: number) => padTop + (1 - a) * innerH;

  const valencePath = chronological
    .map((entry, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getValenceY(entry.valence).toFixed(1)}`)
    .join(' ');

  const arousalPath = chronological
    .map((entry, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getArousalY(entry.arousal).toFixed(1)}`)
    .join(' ');

  const activePoint =
    hoverIdx !== null && chronological[hoverIdx]
      ? chronological[hoverIdx]
      : chronological[chronological.length - 1];

  return (
    <div className="flex flex-col">
      <div className={`flex flex-wrap items-center justify-between gap-2 mb-2 text-xs font-mono ${
        isLight ? 'text-slate-600' : 'text-slate-400'
      }`}>
        <div className="flex items-center gap-3">
          <span className={isLight ? 'text-cyan-700 font-semibold' : 'text-cyan-400'}>
            SOLID: VALENCE (-1.0 TO +1.0)
          </span>
          <span aria-hidden="true">·</span>
          <span className={isLight ? 'text-amber-700 font-semibold' : 'text-amber-400'}>
            DASHED: AROUSAL (0.0 TO 1.0)
          </span>
        </div>
        {activePoint && (
          <div className={`tabular-nums ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
            <span>
              T: {new Date(activePoint.timestamp).toLocaleTimeString([], { hour12: false })}
            </span>
            <span className={`mx-1.5 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>·</span>
            <span style={{ color: EMOTION_COLORS[activePoint.dominantEmotion] }} className="font-semibold">
              {EMOTION_LABELS[activePoint.dominantEmotion].toUpperCase()} ({activePoint.confidence.toFixed(1)}%)
            </span>
            <span className={`mx-1.5 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>·</span>
            <span>
              V: {activePoint.valence >= 0 ? `+${activePoint.valence.toFixed(2)}` : activePoint.valence.toFixed(2)}
            </span>
            <span className={`mx-1.5 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>·</span>
            <span>A: {activePoint.arousal.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className={`relative w-full overflow-x-auto border ${
        isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#080B11]'
      }`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 cursor-crosshair select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((norm) => {
            const y = padTop + norm * innerH;
            const valLabel = (1 - norm * 2).toFixed(1);
            return (
              <g key={norm}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={
                    norm === 0.5
                      ? isLight ? '#94A3B8' : '#334155'
                      : isLight ? '#E2E8F0' : '#1E293B'
                  }
                  strokeDasharray={norm === 0.5 ? '2 2' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className={`font-mono text-[10px] ${
                    isLight ? 'fill-slate-500' : 'fill-slate-400'
                  }`}
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          <path
            d={arousalPath}
            fill="none"
            stroke={isLight ? '#D97706' : '#F59E0B'}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          <path
            d={valencePath}
            fill="none"
            stroke={isLight ? '#0891B2' : '#06B6D4'}
            strokeWidth="2"
          />

          {chronological.map((entry, idx) => {
            const cx = getX(idx);
            const cyVal = getValenceY(entry.valence);
            const hasAlert = entry.triggeredAlertIds && entry.triggeredAlertIds.length > 0;
            const colW = innerW / chronological.length;

            return (
              <g key={entry.id}>
                {hasAlert && (
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={height - padBottom}
                    stroke={isLight ? 'rgba(225, 29, 72, 0.35)' : 'rgba(244, 63, 94, 0.35)'}
                    strokeWidth="2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cyVal}
                  r={hoverIdx === idx ? 4.5 : hasAlert ? 3.5 : 2}
                  fill={hasAlert ? '#E11D48' : isLight ? '#0891B2' : '#06B6D4'}
                />
                <rect
                  x={cx - colW / 2}
                  y={padTop}
                  width={Math.max(8, colW)}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              </g>
            );
          })}

          {hoverIdx !== null && chronological[hoverIdx] && (
            <line
              x1={getX(hoverIdx)}
              y1={padTop}
              x2={getX(hoverIdx)}
              y2={height - padBottom}
              stroke={isLight ? '#475569' : '#94A3B8'}
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

interface CircumplexProps {
  logs: TelemetryLogEntry[];
  theme?: 'light' | 'dark';
}

export const CircumplexAffectMatrix: React.FC<CircumplexProps> = ({ logs, theme = 'dark' }) => {
  const isLight = theme === 'light';
  const size = 260;
  const pad = 26;
  const inner = size - pad * 2;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`border select-none ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#080B11]'
        }`}
      >
        <line
          x1={pad}
          y1={center}
          x2={size - pad}
          y2={center}
          stroke={isLight ? '#94A3B8' : '#334155'}
          strokeWidth="1"
        />
        <line
          x1={center}
          y1={pad}
          x2={center}
          y2={size - pad}
          stroke={isLight ? '#94A3B8' : '#334155'}
          strokeWidth="1"
        />

        <circle
          cx={center}
          cy={center}
          r={inner / 2}
          fill="none"
          stroke={isLight ? '#CBD5E1' : '#1E293B'}
          strokeWidth="1"
        />
        <circle
          cx={center}
          cy={center}
          r={inner / 4}
          fill="none"
          stroke={isLight ? '#E2E8F0' : '#1E293B'}
          strokeDasharray="2 2"
          strokeWidth="1"
        />

        <text
          x={pad + 6}
          y={pad + 12}
          className={`font-mono text-[9px] font-medium ${
            isLight ? 'fill-rose-700' : 'fill-rose-400/80'
          }`}
        >
          Q2: HIGH STRESS / ANGER
        </text>
        <text
          x={size - pad - 6}
          y={pad + 12}
          textAnchor="end"
          className={`font-mono text-[9px] font-medium ${
            isLight ? 'fill-emerald-700' : 'fill-emerald-400/80'
          }`}
        >
          Q1: ELATED / ENGAGED
        </text>
        <text
          x={pad + 6}
          y={size - pad - 6}
          className={`font-mono text-[9px] font-medium ${
            isLight ? 'fill-indigo-700' : 'fill-indigo-400/80'
          }`}
        >
          Q3: DYSPHORIC / FATIGUE
        </text>
        <text
          x={size - pad - 6}
          y={size - pad - 6}
          textAnchor="end"
          className={`font-mono text-[9px] font-medium ${
            isLight ? 'fill-cyan-700' : 'fill-cyan-400/80'
          }`}
        >
          Q4: CALM / FOCUS
        </text>

        {logs.slice(0, 35).map((entry, idx) => {
          const px = center + entry.valence * (inner / 2);
          const py = size - pad - entry.arousal * inner;
          const isLatest = idx === 0;
          return (
            <circle
              key={entry.id}
              cx={px}
              cy={py}
              r={isLatest ? 5.5 : 3}
              fill={EMOTION_COLORS[entry.dominantEmotion]}
              fillOpacity={isLatest ? 1 : 0.75}
              stroke={isLatest ? (isLight ? '#0F172A' : '#F8FAFC') : 'none'}
              strokeWidth={isLatest ? 1.5 : 0}
            />
          );
        })}
      </svg>
      <div className={`mt-2 text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        X-AXIS: VALENCE (-1..+1) · Y-AXIS: AROUSAL (0..1)
      </div>
    </div>
  );
};
