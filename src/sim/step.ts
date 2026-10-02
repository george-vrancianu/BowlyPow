import type { PlayerId, Point } from './pitch'
import { initialPlayers, type Player } from './player'
import type { Wall } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Wall

export type SimEvent = { type: string }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
}

/** Per-tick input from both players; filled out by later tickets. */
export type SimInput = { blast?: { origin: Point; power: number }; placeWall?: Wall }

export type SimConfig = { tickHz: number }

export const defaultConfig: SimConfig = { tickHz: 60 }

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers() }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  _config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  const objects = input.placeWall ? [...state.objects, input.placeWall] : state.objects
  return { state: { ...state, tick: state.tick + 1, objects }, events: [] }
}
