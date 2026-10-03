import { PLAYER_COLORS } from '../sim/player'
import type { PlayerId, Point } from '../sim/pitch'
import type { SimEvent } from '../sim/step'

const FLIP_MS = 400
const GOAL_MS = 1500
const SWEEP_MS = 1000
const REVEAL_MS = 1500
const DISMISS_MS = 1000

type Overlay = { kind: 'turn' | 'goal' | 'sweep' | 'reveal'; at: number; player: PlayerId; text: string; hint?: string; ms: number; net?: Point }
/** `shown` is whose end of the pitch is at the bottom of the screen; `due` = a handover is waiting (e.g. for the goal hold to end). */
export type Transition = { shown: PlayerId; flip?: { at: number; ms: number; from: PlayerId; to: PlayerId }; overlay?: Overlay; due?: boolean; phase?: string; opening?: boolean }

export const newTransition = (active: PlayerId): Transition => ({ shown: active, due: true })

const rot = (p: PlayerId) => (p === 1 ? 0 : 180)

/** `handover` false = online: each player always sits at the bottom, so no flip or turn card. */
export type Frame = { handover?: boolean; active: PlayerId; /** Round number for modes that have rounds; the first-play hints show on round 1. */ round?: number; inHand: boolean; phase: string; /** A Siege opening build is in progress (not a Rearrange turn); its end triggers the reveal. */ opening?: boolean; events: SimEvent[]; now: number; reduced: boolean }

/** Call each tick (with that tick's events) and once per frame. Pure; the sim never waits on it, the shell pauses `step` while `blocking`. */
export function advance(t: Transition, f: Frame): Transition {
  let { shown, flip, overlay, due } = t
  if (flip && f.now >= flip.at + flip.ms) (shown = flip.to), (flip = undefined)
  if (overlay && overlay.kind !== 'turn' && f.now >= overlay.at + overlay.ms) overlay = undefined
  for (const ev of f.events) {
    if (ev.type === 'goal') overlay = { kind: 'goal', at: f.now, player: ev.scorer, text: 'GOAL', ms: GOAL_MS, net: ev.at }
    if (ev.type === 'round-ended') due = true
    if (ev.type === 'repaired') overlay = { kind: 'sweep', at: f.now, player: ev.player, text: 'REPAIRED', ms: SWEEP_MS }
  }
  // The second Done of a Siege opening build lifts the fog into a 1.5 s hold on the whole pitch; the same hold under reduced motion (it has no animation to drop).
  if (t.opening && !f.opening) (overlay = { kind: 'reveal', at: f.now, player: f.active, text: 'REVEAL', ms: REVEAL_MS }), (due = true)
  if (t.phase !== undefined && t.phase !== f.phase && overlay?.kind !== 'goal' && overlay?.kind !== 'reveal') overlay = { kind: 'sweep', at: f.now, player: f.active, text: f.phase.toUpperCase(), ms: SWEEP_MS }
  // The handover waits for the REPAIRED sweep, so the flash and label are seen before the turn flips.
  const repairing = overlay?.kind === 'sweep' && overlay.text === 'REPAIRED'
  if (f.handover === false) due = false
  else if ((due || f.active !== shown) && !flip && !repairing && overlay?.kind !== 'goal' && overlay?.kind !== 'reveal' && overlay?.kind !== 'turn') {
    const ms = f.reduced ? 0 : FLIP_MS
    if (ms) flip = { at: f.now, ms, from: shown, to: f.active }
    else shown = f.active
    const hint = f.round === 1 ? (f.phase === 'Build' ? 'Pick a shape, drag it, Rotate, Confirm, then Done' : f.inHand ? 'Tap to place the ball, then Confirm' : 'Hold on the pitch to charge a blast') : undefined
    overlay = { kind: 'turn', at: f.now, player: f.active, text: `Player ${f.active}'s turn`, hint, ms }
    due = false
  }
  // A phase change during the goal hold is announced once the hold ends.
  return { shown, flip, overlay, due, opening: f.opening, phase: overlay?.kind === 'goal' ? t.phase : f.phase }
}

/** The shell stops stepping the sim while a flip, goal, turn or REPAIRED overlay is up: the conceder's clock and ball are out of reach until the handover is seen. */
export const blocking = (t: Transition) => !!t.flip || t.overlay?.kind === 'goal' || t.overlay?.kind === 'turn' || t.overlay?.kind === 'reveal' || (t.overlay?.kind === 'sweep' && t.overlay.text === 'REPAIRED')

/** The reveal hold is up: the shell shows the whole pitch through the map camera. */
export const revealing = (t: Transition) => t.overlay?.kind === 'reveal'

/** Tap on the turn overlay; ignored in its first second. */
export const dismiss = (t: Transition, now: number): Transition => (t.overlay?.kind === 'turn' && !t.flip && now - t.overlay.at >= DISMISS_MS ? { ...t, overlay: undefined } : t)

/** Screen rotation in degrees (canvas and HUD together). */
export function angle(t: Transition, now: number): number {
  if (!t.flip) return rot(t.shown)
  const p = Math.min(1, (now - t.flip.at) / t.flip.ms)
  return rot(t.flip.from) + (rot(t.flip.to) - rot(t.flip.from)) * p
}

/** Where the ball rests in the net during the goal hold (the sim has already reset it). */
export const goalBall = (t: Transition) => (t.overlay?.kind === 'goal' ? t.overlay.net : undefined)

export function overlayView(t: Transition, now: number) {
  const o = t.overlay
  if (!o) return undefined
  const half = t.flip ? t.flip.ms / 2 : 0
  const opacity = o.kind === 'turn' && t.flip ? Math.max(0, Math.min(1, (now - t.flip.at - half) / half)) : 1
  return { kind: o.kind, text: o.text, hint: o.hint, color: PLAYER_COLORS[o.player], opacity, progress: Math.min(1, (now - o.at) / o.ms), dismissable: o.kind === 'turn' && !t.flip && now - o.at >= DISMISS_MS }
}
