import { rules } from '../config/rules'
import type { PlayerId, Point } from './pitch'
import { nearestOnWall } from './near'
import type { SimConfig } from './step'
import type { Structure } from './wall'

export const splashRadius = (power: number, c: SimConfig): number => rules.splash.radiusBase * c.ballRadius * (1 + rules.splash.radiusGrowth * power)

/** Every structure within the radius, with the hit points it loses (possibly 0) and its nearest point to the origin. The halfway line is not considered. */
export function splashDamage(objects: Structure[], origin: Point, power: number, player: PlayerId, c: SimConfig): { wall: Structure; loss: number; at: Point }[] {
  const r = splashRadius(power, c)
  return objects.flatMap((wall) => {
    const { at, dist } = nearestOnWall(wall, origin)
    if (dist >= r) return []
    const pressure = power * (1 - dist / r)
    const loss = wall.owner === player ? (pressure > rules.splash.heavy ? 1 : 0) : pressure > rules.splash.heavy ? 2 : pressure > rules.splash.light ? 1 : 0
    return [{ wall, loss, at }]
  })
}
