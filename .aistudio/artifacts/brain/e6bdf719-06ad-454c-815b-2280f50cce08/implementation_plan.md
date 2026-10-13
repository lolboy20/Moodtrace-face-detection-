# MoodTrace — Real-Time Biometric Emotion Detection & Cloud Analytics

A full-stack facial affect recognition and biometric telemetry application that detects, analyzes, and logs all 7 universal emotions plus cognitive focus in real time across both Live Camera and Synthetic Simulation modes, complete with a persistent cloud dashboard and customizable mood pattern alerting.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been confirmed from your selections and will govern the implementation:

- **Confirmed Decision 1 (Dual-Mode Expression Visibility)**: Both input modes — **Live Optical Camera** and **Synthetic Simulation Mode** — will simultaneously display the full spectrum of all emotions in real time, so you can inspect live facial expressions as well as simulated FACS expressions side by side or individually.
- **Confirmed Decision 2 (Complete Affect Spectrum)**: The system will track and render all **7 universal emotions plus cognitive focus**: `Joy`, `Focus`, `Neutral`, `Surprise`, `Sadness`, `Anger`, and `Fear`, along with circumplex `Valence` (-1.00 to +1.00), `Arousal` (0.00 to 1.00), and rPPG estimated heart rate (`BPM`).
- **Confirmed Decision 3 (Visualization Pairing)**: All expressions in both modes will be rendered with real-time probability percentage bars alongside a calibrated 7-axis polygonal spider radar chart, dual-axis valence/arousal waveforms, and Russell's 2D circumplex matrix.
- **Confirmed Decision 4 (File Recovery & Architecture)**: Because the project workspace was cleared, execution will rebuild the complete runtime scaffold (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `server.ts`, and client source modules) with Express full-stack persistence on port 3000.

---

### 1. Overview & Core Concept

- **What It Does**: MoodTrace captures live video from the device webcam or an interactive synthetic biometric simulator, extracts 68-point facial landmarks and Facial Action Coding System (FACS) Action Units (`AU01`, `AU04`, `AU06`, `AU12`, `AU15`, `AU26`), computes real-time probability distributions across all 8 emotional dimensions at 30 FPS, streams telemetry frames to a persistent cloud database, and triggers customizable mood alerts when specific sustained patterns occur.
- **Target Audience / Persona**: Researchers, accessibility specialists, focus/wellbeing observers, and user experience evaluators seeking objective, real-time affective telemetry without external cloud API dependencies.
- **Key Value**: Immediate feedback with zero inference latency, resilient operation across both physical cameras and simulated test subjects, and high-density cloud data analytics.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Live Camera & Biometric Tracking**:
   - The user opens MoodTrace, grants camera access (or switches seamlessly to Simulation mode), and sees the live 68-point anatomical mesh overlay, bounding reticle, head pose angles, and heart rate estimate.
   - Below the viewport, an 8-column live probability bar matrix and an adjacent 7-axis radar chart update continuously at 30 FPS.
2. **Simulation Mode & Expression Sculpting**:
   - The user can select preset expression scenarios (`Deep Cognitive Flow`, `Duchenne Joy & Rapport`, `Frustration & Brow Tension`, `Operator Fatigue & Sadness Drift`, `Acute Startle / Surprise Spike`, `Resting Baseline Equilibrium`) or adjust 6 FACS Action Unit sliders to dynamically deform the synthetic face mesh and trigger specific emotional states.
3. **Customizable Mood Pattern Alerts**:
   - The user creates or tunes alert rules (e.g., *Anger $\ge$ 48% sustained for 3 samples*, *Negative Valence $\ge$ 60% sustained for 4 samples*).
   - When a rule fires, a scientific acoustic chime plays, an alert banner appears, and the incident is recorded in the cloud ledger.
4. **Cloud Analytics & Event Ledger**:
   - Longitudinal dual-axis waveforms (Valence and Arousal) with interactive crosshair inspection, Russell circumplex quadrant scatter plot, and filterable high-density tabular logs with CSV export.

#### Visual Identity & Theme
- **Aesthetic Direction**: High-precision telemetry console following scientific and laboratory instrumentation aesthetics (`references/8_science_space_biotech.md` and `references/3_saas_dashboard.md`).
- **Color Palette (60-30-10 Rule)**:
  - 60% Obsidian Black Canvas (`#080B11`)
  - 30% Structural Slate Panels (`#0F141F`) with hairline borders (`#1E293B`)
  - 10% Phosphor Cyan Accent (`#06B6D4`) paired with semantic status colors:
    - Joy: Emerald (`#10B981`)
    - Focus: Phosphor Cyan (`#06B6D4`)
    - Neutral: Cool Slate (`#94A3B8`)
    - Surprise: Telemetry Amber (`#F59E0B`)
    - Sadness: Indigo (`#6366F1`)
    - Anger: Crimson Rose (`#F43F5E`)
    - Fear: Violet (`#A855F7`)
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans`
  - Telemetry & Data Tables: `JetBrains Mono` with strictly enforced `tabular-nums`
- **Zero-Pill Discipline**:
  - No candy pill enclosures or bordered chips for static metadata. All tags, coordinates, and timestamps use clean unboxed text separated by subtle typographic dots (`·`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Mode Simultaneous Expression Visualization**
  - *Chosen Approach*: Both Live Camera and Simulation mode share the exact same 7-emotion + Focus probability matrix, FACS Action Unit readouts, and 7-axis spider radar. Switching between camera and simulation maintains continuous telemetry display without re-rendering or hiding metric channels.
  - *Why*: Enables side-by-side consistency and allows testing alert rules in simulation before validating on a physical camera.
- **Decision 2: Client-Side 30 FPS Computer Vision + Full-Stack Express Server**
  - *Chosen Approach*: Landmark detection and FACS calculation run in real time on the client via canvas pixel/gradient segmentation and geometric morphing, while an Express backend (`server.ts`) handles REST ingestion (`/api/telemetry/*`), rule persistence, incident logging, and file export.
  - *Why*: Eliminates network latency for live 30 FPS visual tracking while providing genuine cloud persistence across browser refreshes.
- **Decision 3: Sustained Multi-Sample Rule Windows**
  - *Chosen Approach*: Alerts trigger only when a threshold condition is satisfied across a configurable window of consecutive samples (e.g., 3–5 samples) rather than a single noisy frame.
  - *Why*: Prevents erratic false positives from transient facial twitches or blinks.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MOODTRACE APPLICATION                           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌────────────────────────────────┐         ┌────────────────────────────────┐
│   OPTION 1: LIVE CAMERA FEED   │         │  OPTION 2: SIMULATION MESH     │
│  - Device WebCam via getUser-  │         │  - 68-pt Anatomical 3D Mesh    │
│    Media (1280x720 30fps)      │         │  - 6 Interactive FACS Sliders  │
│  - Regional Gradient & Skin-   │         │  - 6 Clinical Emotion Scenarios│
│    Chrominance Segmentation    │         │  - Real-time Micro-Expressions │
└────────────────┬───────────────┘         └────────────────┬───────────────┘
                 │                                          │
                 └────────────────────┬─────────────────────┘
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         FACS & AFFECT SOLVER ENGINE          │
               │  - AU01, AU04, AU06, AU12, AU15, AU26        │
               │  - 7 Universal Emotions + Focus Distribution │
               │  - Valence (-1..+1) & Arousal (0..1) Vectors │
               │  - Optical rPPG Heart Rate BPM Estimation    │
               └──────────────────────┬───────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌───────────────────┐        ┌───────────────────┐       ┌────────────────────┐
│ REAL-TIME BARS &  │        │  MOOD ALERT RULE  │       │  EXPRESS BACKEND   │
│ 7-AXIS RADAR HUD  │        │      ENGINE       │       │  & CLOUD STORAGE   │
│ - 8-channel bars  │        │ - Sustained window│       │ - REST /api/state  │
│ - Polygonal radar │        │ - Severity levels │       │ - Incident ledger  │
│ - Waveform graph  │        │ - Acoustic chimes │       │ - CSV Data export  │
└───────────────────┘        └───────────────────┘       └────────────────────┘
```

#### Core Data Models
- **`EmotionScores`**: Probabilities for `joy`, `focus`, `neutral`, `surprise`, `sadness`, `anger`, `fear`.
- **`ActionUnits`**: Numerical values (0–100) for `AU01_InnerBrowRaiser`, `AU04_BrowLowerer`, `AU06_CheekRaiser`, `AU12_LipCornerPuller`, `AU15_LipCornerDepressor`, `AU26_JawDrop`.
- **`TelemetryLogEntry`**: Timestamped cloud snapshot with dominant emotion, confidence, valence, arousal, heart rate estimate, scores, and triggered alert IDs.
- **`MoodAlertRule`**: Customizable rule with name, metric, operator (`gte`/`lte`), threshold %, sustained sample count, severity, audio chime toggle, and trigger counters.
- **`AlertIncident`**: Recorded event with timestamp, measured value vs. threshold, dominant affect, and acknowledgment state.
