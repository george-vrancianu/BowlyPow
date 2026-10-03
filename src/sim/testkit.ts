import { defaultConfig, initialState, step, type SimState } from './step'
import type { RoundsMatch } from './match'
import type { PlayerId } from './pitch'
import type { PowerUp } from './player'
import type { StructureSpec } from './wall'

/** A fresh state already in the play phase (build turns are skipped). */
export const playState = (seed = 1): SimState => {
  const s = initialState(seed)
  return { ...s, match: { ...s.match, builder: null } }
}

/** A fresh state in `owner`'s build turn. */
export const buildState = (owner: PlayerId): SimState => {
  const s = playState()
  return { ...s, match: { ...s.match, builder: owner } }
}

/** Steps a placement as its owner's build turn would, then returns to the play phase. */
export const place = (spec: StructureSpec, s = playState()) => {
  const r = step({ ...s, match: { ...s.match, builder: spec.owner } }, { placeWall: spec }, defaultConfig)
  const state: SimState = { ...r.state, match: { ...r.state.match, builder: null } }
  return { ...r, state }
}

/** `s` with `player`'s stock of `power` emptied. */
export const emptied = (s: SimState, player: PlayerId, power: PowerUp): SimState => ({ ...s, players: { ...s.players, [player]: { ...s.players[player], inventory: { ...s.players[player].inventory, [power]: 0 } } } })

/** The Rounds match inside `s`, for tests that read round, score or round shots. */
export const roundsMatch = (s: SimState): RoundsMatch => {
  if (s.match.mode !== 'rounds') throw new Error('not a Rounds match')
  return s.match
}
