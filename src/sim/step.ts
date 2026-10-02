import type { PlayerId, Point } from './pitch'
import { initialPlayers, type Player } from './player'
import { isLegal, type Wall } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Wall

export type SimEvent = { type: string }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
  /** Wall points; demolishing spends them. */
  points: Record<PlayerId, number>
}

/** Per-tick input from both players; filled out by later tickets. */
export type SimInput = { blast?: { origin: Point; power: number }; placeWall?: Wall; demolish?: { player: PlayerId; index: number } }

export type SimConfig = { tickHz: number }

export const defaultConfig: SimConfig = { tickHz: 60 }

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers(), points: { 1: 10, 2: 10 } }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  _config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  let { objects, points } = state
  const events: SimEvent[] = []
  if (input.placeWall) {
    if (isLegal(input.placeWall)) objects = [...objects, input.placeWall]
    else events.push({ type: 'refused' })
  }
  const { demolish } = input
  if (demolish) {
    if (objects[demolish.index]?.owner === demolish.player && points[demolish.player] >= 1) {
      objects = objects.filter((_, i) => i !== demolish.index)
      points = { ...points, [demolish.player]: points[demolish.player] - 1 }
    } else events.push({ type: 'refused' })
  }
  return { state: { ...state, tick: state.tick + 1, objects, points }, events }
}
