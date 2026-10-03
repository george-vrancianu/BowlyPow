const ink = '#e8eaf0'
const dark = '#0b0f1a'
const outline = '#05070d'
const illegal = '#ef4444'
const white = '#fff'
const cream = '#f4f4f0'

/** Every visual value, grouped by the entity that draws or animates it. Times are ms unless named otherwise. */
export const visual = {
  /** The frame loop never advances more than this many seconds at once. */
  frame: { maxDtS: 0.25 },
  player: { colors: { 1: '#22d3ee', 2: '#fb923c' } },
  camera: {
    maxVisibleHeight: 64,
    smoothingS: 0.15,
    edgeFadeFraction: 0.06,
    mapOutline: white,
    /** A blast of at least `minPower` shakes the view by `max * power` px, decaying over `ms`. */
    shake: { ms: 200, max: 4, minPower: 0.3, freqX: 0.11, freqY: 0.137 },
  },
  pitch: { bg: dark, bgClear: 'rgba(11,15,26,0)', board: '#3a4258', pitch: '#121a2b', line: '#2c3a57', net: '#1d2740', halfTint: 0.05 },
  wall: {
    outline,
    illegal,
    ownTint: '#7f1d1d',
    hatchStripe: '#7c2d12',
    shatterMs: 400,
    shatterFly: 6,
    shatterSpin: 4,
    flash: white,
    flashMs: 100,
    dimFlashMs: 50,
    dimFlashAlpha: 0.35,
    particles: { ms: 400, minSpeed: 4, speedRange: 8, crack: 4, destroy: 12, breaker: 24 },
  },
  tower: { outline, glow: white, glowMs: 300, spentAlpha: 0.3 },
  ball: {
    fill: cream,
    outline,
    illegal,
    trail: 'rgba(255,255,255,0.5)',
    trailBright: white,
    trailClear: 'rgba(255,255,255,0)',
    trailMs: 500,
    trailLength: 0.08,
    stealMs: 300,
  },
  aim: {
    dwellMs: 1000,
    rampMs: 1500,
    chargeSteps: 20,
    /** Charge ring colour runs from `chargeFrom` to `chargeTo` (RGB) with power. */
    chargeFrom: [90, 90, 90],
    chargeTo: [255, 40, 40],
    arrow: cream,
    waveMs: 250,
    wave: cream,
    vibration: { blastBase: 10, blastPerPower: 40, goal: [60, 40, 60], chargeFull: 15 },
  },
  input: { slopPx: 12, tapSlopPx: 12, dragSlopPx: 6, edgeScrollSpeed: 30, touchTargetPx: 22 },
  transition: { flipMs: 400, goalMs: 1500, sweepMs: 1000, dismissMs: 1000, revealMs: 1500 },
  hud: { ink, dark, panel: '#141a2a', track: '#3b4256', urgent: '#ff4d4d', urgentSeconds: 5, urgentPulse: 0.15, scrim: 'rgba(11,15,26,0.85)', scrimLight: 'rgba(11,15,26,0.7)', pressed: '#2a3350', pressedBorder: white },
} as const
