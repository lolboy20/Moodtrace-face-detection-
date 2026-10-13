import type {
  ActionUnits,
  EmotionType,
  FaceBoundingBox,
  HeadPose,
} from '../types/telemetry';
import { EMOTION_COLORS, EMOTION_LABELS } from './emotionEngine';

export interface RenderOverlayOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  sourceMode: 'optical_camera' | 'synthetic_calibration';
  box: FaceBoundingBox;
  actionUnits: ActionUnits;
  headPose: HeadPose;
  dominantEmotion: EmotionType;
  confidence: number;
  valence: number;
  arousal: number;
  heartRateEstBpm: number;
  showMesh: boolean;
  showBoundingBox: boolean;
  showActionUnitVectors: boolean;
  timestampMs: number;
  theme?: 'light' | 'dark';
}

export function renderBiometricOverlay(opts: RenderOverlayOptions): void {
  const {
    ctx,
    width,
    height,
    sourceMode,
    box,
    actionUnits,
    headPose,
    dominantEmotion,
    confidence,
    valence,
    arousal,
    heartRateEstBpm,
    showMesh,
    showBoundingBox,
    showActionUnitVectors,
    timestampMs,
    theme = 'dark',
  } = opts;

  ctx.clearRect(0, 0, width, height);

  const isLight = theme === 'light';
  const accentColor = EMOTION_COLORS[dominantEmotion] || (isLight ? '#0891B2' : '#06B6D4');

  if (sourceMode === 'synthetic_calibration') {
    ctx.fillStyle = isLight ? '#F1F5F9' : '#070A10';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.7)' : 'rgba(30, 41, 59, 0.55)';
    ctx.lineWidth = 1;
    const step = 36;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      width * 0.08,
      width * 0.5,
      height * 0.5,
      width * 0.55
    );
    if (isLight) {
      grad.addColorStop(0, 'rgba(8, 145, 178, 0.07)');
      grad.addColorStop(1, 'rgba(241, 245, 249, 0.9)');
    } else {
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.06)');
      grad.addColorStop(1, 'rgba(7, 10, 16, 0.85)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  const bx = box.x * width;
  const by = box.y * height;
  const bw = box.width * width;
  const bh = box.height * height;
  const cx = bx + bw * 0.5 + headPose.yaw * 1.1;
  const cy = by + bh * 0.5 + headPose.pitch * 1.1;

  if (showBoundingBox) {
    ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.35)' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);

    const cornerLen = Math.min(bw, bh) * 0.14;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + cornerLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cornerLen, by);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - cornerLen, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + cornerLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - cornerLen);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + cornerLen, by + bh);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - cornerLen, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - cornerLen);
    ctx.stroke();

    // Readout label bar
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(8, 11, 17, 0.86)';
    ctx.fillRect(bx, Math.max(4, by - 26), Math.min(bw, 265), 22);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, Math.max(4, by - 26), Math.min(bw, 265), 22);

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = accentColor;
    ctx.fillText(
      `${EMOTION_LABELS[dominantEmotion].toUpperCase()} · ${confidence.toFixed(1)}%`,
      bx + 8,
      Math.max(19, by - 11)
    );
  }

  const au01 = actionUnits.AU01_InnerBrowRaiser / 100;
  const au04 = actionUnits.AU04_BrowLowerer / 100;
  const au06 = actionUnits.AU06_CheekRaiser / 100;
  const au12 = actionUnits.AU12_LipCornerPuller / 100;
  const au15 = actionUnits.AU15_LipCornerDepressor / 100;
  const au26 = actionUnits.AU26_JawDrop / 100;

  const rx = bw * 0.42;
  const ry = bh * 0.44;

  if (showMesh) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((headPose.roll * Math.PI) / 180);

    const jawPoints: Array<[number, number]> = [];
    const jawDropOffset = au26 * ry * 0.16;
    for (let i = -8; i <= 8; i++) {
      const t = i / 8;
      const angle = t * (Math.PI * 0.47);
      const px = Math.sin(angle) * rx;
      const chinExtra = (1 - Math.abs(t)) * jawDropOffset;
      const py = Math.cos(angle) * ry * 0.92 + chinExtra - ry * 0.05;
      jawPoints.push([px, py]);
    }

    const noseBridge: [number, number] = [0, -ry * 0.18];
    const noseTip: [number, number] = [0, ry * 0.08];

    ctx.strokeStyle = isLight ? 'rgba(8, 145, 178, 0.25)' : 'rgba(6, 182, 212, 0.18)';
    ctx.lineWidth = 1;
    jawPoints.forEach(([jx, jy], idx) => {
      if (idx % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(noseTip[0], noseTip[1]);
        ctx.lineTo(jx, jy);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = isLight ? 'rgba(51, 65, 85, 0.65)' : 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    jawPoints.forEach(([jx, jy], idx) => {
      if (idx === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    });
    ctx.stroke();

    const browInnerLift = -au01 * ry * 0.15 + au04 * ry * 0.12;
    const browArchLift = -au01 * ry * 0.08 + au04 * ry * 0.06;
    const browPinch = au04 * rx * 0.07;

    const leftBrow: Array<[number, number]> = [
      [-rx * 0.62, -ry * 0.34],
      [-rx * 0.48, -ry * 0.43 + browArchLift],
      [-rx * 0.32, -ry * 0.44 + browArchLift],
      [-rx * 0.16 + browPinch, -ry * 0.36 + browInnerLift],
    ];
    const rightBrow: Array<[number, number]> = [
      [rx * 0.16 - browPinch, -ry * 0.36 + browInnerLift],
      [rx * 0.32, -ry * 0.44 + browArchLift],
      [rx * 0.48, -ry * 0.43 + browArchLift],
      [rx * 0.62, -ry * 0.34],
    ];

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.8;
    [leftBrow, rightBrow].forEach((brow) => {
      ctx.beginPath();
      brow.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    });

    const eyeOpenness = Math.max(0.04, 0.095 - au06 * 0.04 + au01 * 0.035);
    [-1, 1].forEach((side) => {
      const ex = side * rx * 0.38;
      const ey = -ry * 0.22;
      const ew = rx * 0.18;
      const eh = ry * eyeOpenness;

      ctx.strokeStyle = isLight ? 'rgba(30, 41, 59, 0.85)' : 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
      ctx.stroke();

      const saccadeX = Math.sin(timestampMs * 0.0015) * ew * 0.12;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(ex + saccadeX, ey, Math.min(ew, eh) * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });

    const cheekLift = -au06 * ry * 0.09;
    ctx.strokeStyle = isLight ? 'rgba(8, 145, 178, 0.5)' : 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1.2;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * rx * 0.22, ry * 0.04 + cheekLift);
      ctx.quadraticCurveTo(
        side * rx * 0.52,
        ry * 0.12 + cheekLift,
        side * rx * 0.66,
        -ry * 0.06 + cheekLift
      );
      ctx.stroke();
    });

    ctx.strokeStyle = isLight ? 'rgba(71, 85, 105, 0.75)' : 'rgba(148, 163, 184, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(noseBridge[0], noseBridge[1]);
    ctx.lineTo(noseTip[0], noseTip[1]);
    ctx.moveTo(-rx * 0.14, ry * 0.11);
    ctx.lineTo(0, ry * 0.14);
    ctx.lineTo(rx * 0.14, ry * 0.11);
    ctx.stroke();

    // AU09 Nose Wrinkler Creases
    if (actionUnits.AU09_NoseWrinkler >= 20) {
      const au09Alpha = Math.min(0.9, actionUnits.AU09_NoseWrinkler / 100);
      ctx.strokeStyle = isLight ? `rgba(20, 184, 166, ${au09Alpha})` : `rgba(20, 184, 166, ${au09Alpha})`;
      ctx.lineWidth = 1.3;
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.moveTo(-rx * 0.1, noseBridge[1] + dir * 3.5);
        ctx.lineTo(rx * 0.1, noseBridge[1] + dir * 3.5);
        ctx.stroke();
      });
    }

    const au10UpperLift = (actionUnits.AU10_UpperLipRaiser / 100) * ry * 0.08;
    const mouthY = ry * 0.38 - au10UpperLift;
    const cornerSmileOffset = -au12 * ry * 0.16 + au15 * ry * 0.15;
    const mouthWidth = rx * (0.36 + au12 * 0.12 - au15 * 0.04);
    const lipParting = ry * (0.02 + au26 * 0.16 + au12 * 0.04);

    const leftCorner: [number, number] = [-mouthWidth, mouthY + cornerSmileOffset];
    const rightCorner: [number, number] = [mouthWidth, mouthY + cornerSmileOffset];
    const upperPeak: [number, number] = [0, mouthY - ry * 0.04];
    const lowerDip: [number, number] = [0, mouthY + lipParting + ry * 0.04];

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(leftCorner[0], leftCorner[1]);
    ctx.quadraticCurveTo(0, upperPeak[1], rightCorner[0], rightCorner[1]);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftCorner[0], leftCorner[1]);
    ctx.quadraticCurveTo(0, lowerDip[1], rightCorner[0], rightCorner[1]);
    ctx.stroke();

    const landmarkNodes: Array<[number, number]> = [
      ...jawPoints.filter((_, i) => i % 2 === 0),
      ...leftBrow,
      ...rightBrow,
      noseBridge,
      noseTip,
      leftCorner,
      rightCorner,
      upperPeak,
      lowerDip,
    ];

    ctx.fillStyle = isLight ? '#0F172A' : '#F8FAFC';
    landmarkNodes.forEach(([lx, ly]) => {
      ctx.beginPath();
      ctx.arc(lx, ly, 2.1, 0, Math.PI * 2);
      ctx.fill();
    });

    if (showActionUnitVectors) {
      ctx.strokeStyle = isLight ? '#D97706' : '#F59E0B';
      ctx.fillStyle = isLight ? '#D97706' : '#F59E0B';
      ctx.lineWidth = 1.4;
      ctx.font = '500 10px "JetBrains Mono", monospace';

      if (actionUnits.AU04_BrowLowerer >= 25) {
        ctx.fillText(`AU04 ${actionUnits.AU04_BrowLowerer}%`, -26, -ry * 0.48);
      }
      if (actionUnits.AU09_NoseWrinkler >= 25) {
        ctx.fillText(`AU09 ${actionUnits.AU09_NoseWrinkler}%`, noseBridge[0] + 8, noseBridge[1] + 2);
      }
      if (actionUnits.AU10_UpperLipRaiser >= 25) {
        ctx.fillText(`AU10 ${actionUnits.AU10_UpperLipRaiser}%`, 8, upperPeak[1] - 4);
      }
      if (actionUnits.AU12_LipCornerPuller >= 25) {
        ctx.fillText(`AU12 ${actionUnits.AU12_LipCornerPuller}%`, rightCorner[0] + 8, rightCorner[1]);
      }
      if (actionUnits.AU15_LipCornerDepressor >= 25) {
        ctx.fillText(`AU15 ${actionUnits.AU15_LipCornerDepressor}%`, leftCorner[0] - 58, leftCorner[1] + 10);
      }
      if (actionUnits.AU26_JawDrop >= 25) {
        ctx.fillText(`AU26 ${actionUnits.AU26_JawDrop}%`, 10, lowerDip[1] + 14);
      }
    }

    ctx.restore();
  }

  // Telemetry HUD readouts
  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(8, 11, 17, 0.82)';
  ctx.fillRect(12, height - 42, 340, 30);
  ctx.strokeStyle = isLight ? '#CBD5E1' : 'rgba(30, 41, 59, 0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, height - 42, 340, 30);

  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = isLight ? '#334155' : '#94A3B8';
  const valStr = valence >= 0 ? `+${valence.toFixed(2)}` : valence.toFixed(2);
  ctx.fillText(
    `VALENCE: ${valStr} · AROUSAL: ${arousal.toFixed(2)} · rPPG: ${heartRateEstBpm} BPM`,
    22,
    height - 23
  );

  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(8, 11, 17, 0.82)';
  ctx.fillRect(width - 238, 12, 226, 28);
  ctx.strokeStyle = isLight ? '#CBD5E1' : 'rgba(30, 41, 59, 0.9)';
  ctx.strokeRect(width - 238, 12, 226, 28);
  ctx.fillStyle = isLight ? '#334155' : '#94A3B8';
  ctx.fillText(
    `POSE P:${headPose.pitch.toFixed(1)}° Y:${headPose.yaw.toFixed(1)}° R:${headPose.roll.toFixed(1)}°`,
    width - 228,
    30
  );
}
