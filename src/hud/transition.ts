import { visual } from '../config/visual'
import type { PlayerId, Point } from '../sim/pitch'
import type { SimEvent } from '../sim/step'

type Overlay = { kind: 'turn' | 'goal' | 'sweep'; at: number; player: PlayerId; text: string; hint?: string; ms: number; net?: Point }
/** `shown` is whose end of the pitch is at the bottom of the screen; `due` = a handover is waiting (e.g. for the goal hold to end). */
export type Transition = { shown: PlayerId; flip?: { at: number; ms: number; from: PlayerId; to: PlayerId }; overlay?: Overlay; due?: boolean; phase?: string }

export const newTransition = (active: PlayerId): Transition => ({ shown: active, due: true })

const rot = (p: PlayerId) => (p === 1 ? 0 : 180)

/** `handover` false = online: each player always sits at the bottom, so no flip or turn card. */
export type Frame = { handover?: boolean; active: PlayerId; round: number; inHand: boolean; phase: string; events: SimEvent[]; now: number; reduced: boolean }

/** Call each tick (with that tick's events) and once per frame. Pure; the sim never waits on it, the shell pauses `step` while `blocking`. */
export function advance(t: Transition, f: Frame): Transition {
  let { shown, flip, overlay, due } = t
  if (flip && f.now >= flip.at + flip.ms) (shown = flip.to), (flip = undefined)
  if (overlay && overlay.kind !== 'turn' && f.now >= overlay.at + overlay.ms) overlay = undefined
  for (const ev of f.events) {
    if (ev.type === 'goal') overlay = { kind: 'goal', at: f.now, player: ev.scorer, text: 'GOAL', ms: visual.transition.goalMs, net: ev.at }
    if (ev.type === 'round-ended') due = true
  }
  if (t.phase !== undefined && t.phase !== f.phase && overlay?.kind !== 'goal') overlay = { kind: 'sweep', at: f.now, player: f.active, text: f.phase.toUpperCase(), ms: visual.transition.sweepMs }
  if (f.handover === false) due = false
  else if ((due || f.active !== shown) && !flip && overlay?.kind !== 'goal' && overlay?.kind !== 'turn') {
    const ms = f.reduced ? 0 : visual.transition.flipMs
    if (ms) flip = { at: f.now, ms, from: shown, to: f.active }
    else shown = f.active
    const hint = f.round === 1 ? (f.phase === 'Build' ? 'Pick a shape, drag it, Rotate, Confirm, then Done' : f.inHand ? 'Tap to place the ball, then Confirm' : 'Hold on the pitch to charge a blast') : undefined
    overlay = { kind: 'turn', at: f.now, player: f.active, text: `Player ${f.active}'s turn`, hint, ms }
    due = false
  }
  // A phase change during the goal hold is announced once the hold ends.
  return { shown, flip, overlay, due, phase: overlay?.kind === 'goal' ? t.phase : f.phase }
}

/** The shell stops stepping the sim while a flip, goal or turn overlay is up. */
export const blocking = (t: Transition) => !!t.flip || t.overlay?.kind === 'goal' || t.overlay?.kind === 'turn'

/** Tap on the turn overlay; ignored in its first second. */
export const dismiss = (t: Transition, now: number): Transition => (t.overlay?.kind === 'turn' && !t.flip && now - t.overlay.at >= visual.transition.dismissMs ? { ...t, overlay: undefined } : t)

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
  return { kind: o.kind, text: o.text, hint: o.hint, color: visual.player.colors[o.player], opacity, progress: Math.min(1, (now - o.at) / o.ms), dismissable: o.kind === 'turn' && !t.flip && now - o.at >= visual.transition.dismissMs }
}
