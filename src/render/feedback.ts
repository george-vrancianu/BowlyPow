import type { PlayerId, Point } from '../sim/pitch'
import { PLAYER_COLORS } from '../sim/player'
import type { SimEvent } from '../sim/step'
import type { Structure } from '../sim/wall'

/** Events other tickets add to the sim; power is 0..1.. */
type LaterEvent = { type: 'goal' } | { type: 'charge-full' }
type FxEvent = SimEvent | LaterEvent

export const SHAKE_MS = 200
export const FLASH_MS = 100
export const DIM_FLASH_MS = 50
export const PARTICLE_MS = 400
const MAX_SHAKE = 4

export type Particle = { at: Point; vel: Point; color: string; born: number }
export type Flash = { wall: number; dim: boolean; born: number }
/** A Repulsor fire: ring burst and tower glow last GLOW_MS, the ball's trail brightens for TRAIL_MS. */
export type Pulse = { tower: number; born: number }
export const GLOW_MS = 300
export const TRAIL_MS = 500
/** A Steal trigger: the ball shrinks into the tower for STEAL_MS, then the tower collapses. */
export type Steal = { tower: Structure; at: Point; born: number }
export const STEAL_MS = 300
export type Fx = { particles: Particle[]; flashes: Flash[]; shake: { amp: number; born: number }; pulses: Pulse[]; steals: Steal[] }
export const newFx = (): Fx => ({ particles: [], flashes: [], shake: { amp: 0, born: 0 }, pulses: [], steals: [] })

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vibration pattern for an event, if it has one. */
export function vibration(ev: FxEvent): number | number[] | undefined {
  if (ev.type === 'blast-fired') return Math.round(10 + 40 * ev.power)
  if (ev.type === 'goal') return [60, 40, 60]
  if (ev.type === 'charge-full') return 15
}

/** Screen offset in px at time `now` for a shake of `amp` px that started at `born`, decaying linearly to nothing. */
export function shakeOffset(amp: number, born: number, now: number): Point {
  const t = (now - born) / SHAKE_MS
  if (t < 0 || t >= 1) return { x: 0, y: 0 }
  const a = amp * (1 - t)
  return { x: a * Math.sin(now * 0.11), y: a * Math.cos(now * 0.137) }
}

/** What an event batch should trigger. Pure; `applyEvents` turns it into effects. Flashes survive reduced motion. */
export function feedbackFor(events: FxEvent[], walls: { id: number; owner: PlayerId }[], reduced: boolean) {
  const out = { flashes: [] as { wall: number; dim: boolean }[], bursts: [] as { at: Point; color: string; count: number }[], shakes: [] as number[], vibrations: [] as (number | number[])[] }
  const cracked = new Set(events.flatMap((e) => (e.type === 'wall-cracked' ? [e.id] : [])))
  const color = (id: number) => PLAYER_COLORS[walls.find((w) => w.id === id)?.owner ?? 1]
  for (const ev of events) {
    if (ev.type === 'ball-hit-wall' && !cracked.has(ev.wall)) out.flashes.push({ wall: ev.wall, dim: true })
    if (ev.type === 'wall-cracked') {
      out.flashes.push({ wall: ev.id, dim: false })
      out.bursts.push({ at: ev.at, color: color(ev.id), count: 4 })
    }
    if (ev.type === 'repaired') out.flashes.push({ wall: ev.id, dim: false })
    if (ev.type === 'wall-destroyed') out.bursts.push({ at: ev.at, color: PLAYER_COLORS[ev.wall.owner], count: ev.breaker ? 24 : 12 })
    if (ev.type === 'blast-fired' && ev.power >= 0.3) out.shakes.push(MAX_SHAKE * ev.power)
    const v = vibration(ev)
    if (v !== undefined) out.vibrations.push(v)
  }
  return reduced ? { ...out, bursts: [], shakes: [], vibrations: [] } : out
}

/** Subscribes the effects to a tick's events: records flashes, particles and shake, and vibrates where supported. Call every tick so expired effects drop. */
export function applyEvents(fx: Fx, events: FxEvent[], walls: { id: number; owner: PlayerId }[], now: number): void {
  const r = feedbackFor(events, walls, reducedMotion())
  for (const f of r.flashes) fx.flashes.push({ ...f, born: now })
  for (const b of r.bursts)
    for (let i = 0; i < b.count; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 4 + Math.random() * 8
      fx.particles.push({ at: b.at, vel: { x: Math.cos(a) * s, y: Math.sin(a) * s }, color: b.color, born: now })
    }
  for (const e of events) if (e.type === 'repulsor-fired') fx.pulses.push({ tower: e.tower, born: now })
  for (const e of events) if (e.type === 'steal-triggered') fx.steals.push({ tower: e.tower, at: e.at, born: now })
  for (const amp of r.shakes) fx.shake = { amp, born: now }
  for (const v of r.vibrations) navigator.vibrate?.(v)
  fx.particles = fx.particles.filter((p) => now - p.born < PARTICLE_MS)
  fx.flashes = fx.flashes.filter((f) => now - f.born < FLASH_MS)
  fx.pulses = fx.pulses.filter((p) => now - p.born < TRAIL_MS)
  fx.steals = fx.steals.filter((s) => now - s.born < STEAL_MS)
}
