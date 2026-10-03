import { visual } from '../config/visual'
import type { PlayerId, Point } from '../sim/pitch'
import type { SimEvent } from '../sim/step'

/** Events other tickets add to the sim; power is 0..1.. */
type LaterEvent = { type: 'goal' } | { type: 'charge-full' }
export type FxEvent = SimEvent | LaterEvent

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vibration pattern for an event, if it has one. */
export function vibration(ev: FxEvent): number | number[] | undefined {
  if (ev.type === 'blast-fired') return Math.round(visual.aim.vibration.blastBase + visual.aim.vibration.blastPerPower * ev.power)
  if (ev.type === 'goal') return [...visual.aim.vibration.goal]
  if (ev.type === 'charge-full') return visual.aim.vibration.chargeFull
}

/** What an event batch should trigger. Pure; `Game` turns it into entity calls. Flashes survive reduced motion. */
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
