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
    bg: dark,
    mapOutline: white,
    mapOutlinePx: 2,
    /** A blast of at least `minPower` shakes the view by `max * power` px, decaying over `ms`. */
    shake: { ms: 200, max: 4, minPower: 0.3, freqX: 0.11, freqY: 0.137 },
  },
  /** The soft gradient at a pane edge where more pitch lies beyond, and how far the blind-build cover bleeds past the pitch sides. */
  fog: { bleed: 1, fadeFraction: 0.06, color: dark, clear: 'rgba(11,15,26,0)' },
  pitch: {
    board: '#3a4258',
    pitch: '#121a2b',
    line: '#2c3a57',
    net: '#1d2740',
    halfTint: 0.05,
    goalLineWidth: 0.5,
    halfLineWidth: 0.3,
    gridDot: 0.16,
    /** The builder's no-build semicircle. */
    noBuild: { dash: [0.8, 0.6], lineWidth: 0.15 },
  },
  /** Walls, and the parts every structure shares (outline, cracks, flash, shatter, ghosts). */
  wall: {
    outline,
    illegal,
    ownTint: '#7f1d1d',
    hatchStripe: '#7c2d12',
    /** Player 2's diagonal-stripe tile: size px, stripe px, scale into world units. */
    hatch: { tile: 8, stripe: 2, scale: 0.25 },
    outlineWidth: 1,
    crackWidth: 0.12,
    shatterMs: 400,
    shatterFly: 6,
    shatterSpin: 4,
    flash: white,
    flashMs: 100,
    dimFlashMs: 50,
    dimFlashAlpha: 0.35,
    ghostAlpha: 0.5,
    /** The dashed outline on this turn's pieces and the breathing one on a selection. */
    mark: { pad: 0.6, width: 0.15, movableDash: [0.4, 0.4] },
    selected: { periodMs: 150, alpha: 0.6, alphaSwing: 0.4, pad: 0.8, padSwing: 0.15 },
    particles: { ms: 400, minSpeed: 4, speedRange: 8, crack: 4, destroy: 12, breaker: 24, size: 0.3 },
  },
  tower: {
    outline,
    glow: white,
    glowMs: 300,
    spentAlpha: 0.3,
    outlineWidth: 0.3,
    innerWidth: 0.1,
    innerInset: 0.5,
    /** Repulsor glyph rings and the Steal spiral (turns in radians, step, radius per radian). */
    rings: [0.7, 0.35],
    spiral: { turns: Math.PI * 4, step: 0.2, grow: 0.1 },
    /** Fire effect: ring line width and how far the rings burst outward. */
    pulse: { lineWidth: 0.2, grow: 4 },
  },
  ball: {
    fill: cream,
    outline,
    illegal,
    trail: 'rgba(255,255,255,0.5)',
    trailBright: white,
    trailClear: 'rgba(255,255,255,0)',
    trailMs: 500,
    trailLength: 0.08,
    trailWidth: 2,
    trailWidthBright: 3,
    outlineWidth: 0.12,
    /** The dot that rolls with the distance travelled. */
    dot: { offset: 0.55, radius: 0.2 },
    stealMs: 300,
    ghostAlpha: 0.5,
    /** The Breaker outline. */
    armed: { radius: 1.5, swing: 0.25, periodMs: 120, width: 0.3 },
  },
  aim: {
    dwellMs: 1000,
    rampMs: 1500,
    /** Charge ring colour runs from `chargeFrom` to `chargeTo` (RGB) with power. */
    chargeFrom: [90, 90, 90],
    chargeTo: [255, 40, 40],
    lineWidth: 0.15,
    /** The ring that blinks during the dwell. */
    dwell: { radius: 1.2, periodMs: 120, alpha: 0.5, swing: 0.5 },
    fillAlpha: 0.15,
    /** Radar rings sweeping outward from a charge. */
    radar: { periodMs: 800, phases: [0, 0.5] },
    arrow: cream,
    /** The push preview: length per unit push, head length and spread (radians), alpha. */
    arrowShape: { scale: 0.15, head: 0.8, spread: 0.5, alpha: 0.6 },
    waveMs: 250,
    wave: cream,
    waveWidth: 0.3,
    vibration: { blastBase: 10, blastPerPower: 40, goal: [60, 40, 60], chargeFull: 15 },
  },
  input: { slopPx: 12, tapSlopPx: 12, dragSlopPx: 6, edgeScrollSpeed: 30, edgeBand: 0.1, touchTargetPx: 22 },
  transition: { flipMs: 400, goalMs: 1500, sweepMs: 1000, dismissMs: 1000, revealMs: 1500 },
  hud: { ink, dark, panel: '#141a2a', track: '#3b4256', urgent: '#ff4d4d', urgentSeconds: 5, urgentPulse: 0.15, scrim: 'rgba(11,15,26,0.85)', scrimLight: 'rgba(11,15,26,0.7)', pressed: '#2a3350', pressedBorder: white, scoreFlipMs: 400, shadow: '#0008', gap: 8 },
} as const
