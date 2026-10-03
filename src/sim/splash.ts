import { rules } from '../config/rules'
import type { PlayerId, Point } from './pitch'
import { nearestOnWall } from './near'
import type { SimConfig } from './step'
import type { Structure } from './wall'

/** The Splash power (0-1) a shot sets off: its power rescaled within its tier's range. Null for a tier that does not splash. */
export function splashPower(tier: number, power: number): number | null {
  const t = rules.shot.tiers[tier]
  if (!t?.splash) return null
  const [min, max] = t.power
  return max > min ? Math.min(1, Math.max(0, (power - min) / (max - min))) : 1
}

export const splashRadius = (power: number, c: SimConfig): number => rules.splash.radiusBase * c.ballRadius * (1 + rules.splash.radiusGrowth * power)

/** A Splash: its power (0-1) and radius in world units. */
export type Splash = { power: number; radius: number }

/** The Splash a shot of this tier and power sets off; null for a tier that does not splash. */
export function splashOf(tier: number, power: number, c: SimConfig): Splash | null {
  const p = splashPower(tier, power)
  return p === null ? null : { power: p, radius: splashRadius(p, c) }
}

/** Every structure within the Splash radius, with the hit points it loses (possibly 0) and its nearest point to the origin. The halfway line is not considered. */
export function splashDamage(objects: Structure[], origin: Point, { power, radius: r }: Splash, player: PlayerId): { wall: Structure; loss: number; at: Point }[] {
  return objects.flatMap((wall) => {
    const { at, dist } = nearestOnWall(wall, origin)
    if (dist >= r) return []
    const pressure = power * (1 - dist / r)
    const loss = wall.owner === player ? (pressure > rules.splash.heavy ? 1 : 0) : pressure > rules.splash.heavy ? 2 : pressure > rules.splash.light ? 1 : 0
    return [{ wall, loss, at }]
  })
}
