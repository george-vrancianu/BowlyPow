const ink = '#e8eaf0'
const dark = '#0b0f1a'

/** Every visual value, grouped by the entity that draws or animates it. Times are ms unless named otherwise. */
export const visual = {
  player: { colors: { 1: '#22d3ee', 2: '#fb923c' } as Record<1 | 2, string> },
  camera: { maxVisibleHeight: 64, smoothingS: 0.15, edgeFadeFraction: 0.06 },
  pitch: { bg: dark, board: '#3a4258', pitch: '#121a2b', line: '#2c3a57', net: '#1d2740', halfTint: 0.05, bgClear: 'rgba(11,15,26,0)' },
  wall: { outline: '#05070d', illegal: '#ef4444', ownTint: '#7f1d1d', hatchStripe: '#7c2d12', shatterMs: 400, shatterFly: 6, shatterSpin: 4, flashMs: 100, dimFlashMs: 50, dimFlashAlpha: 0.35 },
  tower: { glowMs: 300, spentAlpha: 0.3, glow: '#fff' },
  ball: { fill: '#f4f4f0', trailMs: 500, trailLength: 0.08, stealMs: 300 },
  aim: { dwellMs: 1000, rampMs: 1500, slopPx: 12, chargeSteps: 20, waveMs: 250, wave: '#f4f4f0', tapSlopPx: 12, minShakePower: 0.3 },
  fx: { shakeMs: 200, maxShake: 4, particleMs: 400, burst: { crack: 4, destroy: 12, breaker: 24 } },
  input: { dragSlopPx: 6, edgeScrollSpeed: 30, touchTargetPx: 22 },
  map: { outline: '#fff' },
  transition: { flipMs: 400, goalMs: 1500, sweepMs: 1000, dismissMs: 1000 },
  hud: { ink, dark, panel: '#141a2a', track: '#3b4256', urgent: '#ff4d4d', scrim: 'rgba(11,15,26,0.85)' },
}
