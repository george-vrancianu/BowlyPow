import { visual } from '../config/visual'
import type { PlayerId, Point } from '../sim/pitch'
import type { SimEvent } from '../sim/step'
import type { Structure } from '../sim/wall'

/** Events other tickets add to the sim; power is 0..1.. */
type LaterEvent = { type: 'goal' } | { type: 'charge-full' }
type FxEvent = SimEvent | LaterEvent

export type Particle = { at: Point; vel: Point; color: string; born: number }
export type Flash = { wall: number; dim: boolean; born: number }
/** A Repulsor fire: ring burst and tower glow last visual.tower.glowMs, the ball's trail brightens for visual.ball.trailMs. */
export type Pulse = { tower: number; born: number }
/** A Steal trigger: the ball shrinks into the tower for visual.ball.stealMs, then the tower collapses. */
export type Steal = { tower: Structure; at: Point; born: number }
export type Fx = { particles: Particle[]; flashes: Flash[]; shake: { amp: number; born: number }; pulses: Pulse[]; steals: Steal[] }
export const newFx = (): Fx => ({ particles: [], flashes: [], shake: { amp: 0, born: 0 }, pulses: [], steals: [] })

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vibration pattern for an event, if it has one. */
export function vibration(ev: FxEvent): number | number[] | undefined {
  if (ev.type === 'blast-fired') return Math.round(visual.aim.vibration.blastBase + visual.aim.vibration.blastPerPower * ev.power)
  if (ev.type === 'goal') return [...visual.aim.vibration.goal]
  if (ev.type === 'charge-full') return visual.aim.vibration.chargeFull
}

/** Screen offset in px at time `now` for a shake of `amp` px that started at `born`, decaying linearly to nothing. */
export function shakeOffset(amp: number, born: number, now: number): Point {
  const t = (now - born) / visual.camera.shake.ms
  if (t < 0 || t >= 1) return { x: 0, y: 0 }
  const a = amp * (1 - t)
  return { x: a * Math.sin(now * visual.camera.shake.freqX), y: a * Math.cos(now * visual.camera.shake.freqY) }
}

/** What an event batch should trigger. Pure; `applyEvents` turns it into effects. Flashes survive reduced motion. */
export function feedbackFor(events: FxEvent[], walls: { id: number; owner: PlayerId }[], reduced: boolean) {
  const out = { flashes: [] as { wall: number; dim: boolean }[], bursts: [] as { at: Point; color: string; count: number }[], shakes: [] as number[], vibrations: [] as (number | number[])[] }
  const cracked = new Set(events.flatMap((e) => (e.type === 'wall-cracked' ? [e.id] : [])))
  const color = (id: number) => visual.player.colors[walls.find((w) => w.id === id)?.owner ?? 1]
  for (const ev of events) {
    if (ev.type === 'ball-hit-wall' && !cracked.has(ev.wall)) out.flashes.push({ wall: ev.wall, dim: true })
    if (ev.type === 'wall-cracked') {
      out.flashes.push({ wall: ev.id, dim: false })
      out.bursts.push({ at: ev.at, color: color(ev.id), count: visual.wall.particles.crack })
    }
    if (ev.type === 'repaired') out.flashes.push({ wall: ev.id, dim: false })
    if (ev.type === 'wall-destroyed') out.bursts.push({ at: ev.at, color: visual.player.colors[ev.wall.owner], count: ev.breaker ? visual.wall.particles.breaker : visual.wall.particles.destroy })
    if (ev.type === 'blast-fired' && ev.power >= visual.camera.shake.minPower) out.shakes.push(visual.camera.shake.max * ev.power)
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
      const s = visual.wall.particles.minSpeed + Math.random() * visual.wall.particles.speedRange
      fx.particles.push({ at: b.at, vel: { x: Math.cos(a) * s, y: Math.sin(a) * s }, color: b.color, born: now })
    }
  for (const e of events) if (e.type === 'repulsor-fired') fx.pulses.push({ tower: e.tower, born: now })
  for (const e of events) if (e.type === 'steal-triggered') fx.steals.push({ tower: e.tower, at: e.at, born: now })
  for (const amp of r.shakes) fx.shake = { amp, born: now }
  for (const v of r.vibrations) navigator.vibrate?.(v)
  fx.particles = fx.particles.filter((p) => now - p.born < visual.wall.particles.ms)
  fx.flashes = fx.flashes.filter((f) => now - f.born < visual.wall.flashMs)
  fx.pulses = fx.pulses.filter((p) => now - p.born < visual.ball.trailMs)
  fx.steals = fx.steals.filter((s) => now - s.born < visual.ball.stealMs)
}
