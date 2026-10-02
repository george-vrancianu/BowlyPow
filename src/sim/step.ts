import type { PlayerId, Point } from './pitch'
import { initialPlayers, type Player } from './player'
import { canPlace, WALL_HP, type Wall, type WallSpec } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Wall

export type SimEvent =
  | { type: 'wall-cracked'; id: number; hp: number; at: Point }
  /** Carries the removed wall (hp 0) so the renderer can shatter it. */
  | { type: 'wall-destroyed'; wall: Wall; at: Point }
  /** An illegal placement or demolition was dropped. */
  | { type: 'refused' }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
  /** Wall points; demolishing spends them. */
  points: Record<PlayerId, number>
  nextId: number
}

/** Per-tick input from both players; filled out by later tickets. `demolish.wall` is a wall id. */
export type SimInput = {
  blast?: { origin: Point; power: number }
  placeWall?: WallSpec
  demolish?: { player: PlayerId; wall: number }
  damage?: { wall: number; at: Point }
}

export type SimConfig = { tickHz: number }

export const defaultConfig: SimConfig = { tickHz: 60 }

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers(), points: { 1: 10, 2: 10 }, nextId: 1 }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  _config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  let { objects, points, nextId } = state
  const events: SimEvent[] = []
  if (input.placeWall) {
    if (canPlace(objects, input.placeWall)) objects = [...objects, { ...input.placeWall, id: nextId++, hp: WALL_HP }]
    else events.push({ type: 'refused' })
  }
  const { demolish } = input
  if (demolish) {
    if (objects.find((w) => w.id === demolish.wall)?.owner === demolish.player && points[demolish.player] >= 1) {
      objects = objects.filter((w) => w.id !== demolish.wall)
      points = { ...points, [demolish.player]: points[demolish.player] - 1 }
    } else events.push({ type: 'refused' })
  }
  const { damage } = input
  const target = damage && objects.find((w) => w.id === damage.wall)
  if (damage && target) {
    const hp = target.hp - 1
    objects = hp > 0 ? objects.map((w) => (w === target ? { ...w, hp } : w)) : objects.filter((w) => w !== target)
    events.push(hp > 0 ? { type: 'wall-cracked', id: target.id, hp, at: damage.at } : { type: 'wall-destroyed', wall: { ...target, hp }, at: damage.at })
  }
  return { state: { ...state, tick: state.tick + 1, objects, points, nextId }, events }
}
