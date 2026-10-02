import type { PlayerId, Point } from './pitch'
import { initialPlayers, type Player } from './player'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = never

export type SimEvent = { type: string }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
}

/** Per-tick input from both players; filled out by later tickets. */
export type SimInput = { blast?: { origin: Point; power: number } }

export type SimConfig = { tickHz: number }

export const defaultConfig: SimConfig = { tickHz: 60 }

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers() }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  _input: SimInput,
  _config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  return { state: { ...state, tick: state.tick + 1 }, events: [] }
}
