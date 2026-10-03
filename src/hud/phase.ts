import type { PlayerId } from '../sim/pitch'
import { canFinishBuild, type SimConfig, type SimInput, type SimState } from '../sim/step'
import type { ButtonSpec } from './hud'

export type PhaseSeam = {
  /** Whether this device plays that seat (online: only your own). */
  mine(p: PlayerId): boolean
  /** The live state. Handlers read it at click time: the HUD keeps a button row while its labels are unchanged, so a handler must never carry the player it was created for. */
  current(): SimState
  send(input: SimInput): void
  /** False while an overlay (the GOAL banner, the turn card) hides the board: the defence choice, Repair and Rearrange alike, is offered only when it is not. Default true. */
  choosable?: boolean
}

/** The phase buttons under the shared strip: Done in a build turn, Repair and Rearrange when the scorer owes a defence choice. */
export function phaseButtons(s: SimState, config: SimConfig, h: PhaseSeam): ButtonSpec[] | undefined {
  const { builder, choosing } = s.match
  if (builder && h.mine(builder)) {
    return [{
      label: 'Done',
      disabled: !canFinishBuild(s, config),
      onClick: () => {
        const b = h.current().match.builder
        if (b && h.mine(b)) h.send({ done: b })
      },
    }]
  }
  if (choosing && h.mine(choosing) && h.choosable !== false) {
    return (['repair', 'rearrange'] as const).map((choice) => ({
      label: choice === 'repair' ? 'Repair' : 'Rearrange',
      onClick: () => {
        const c = h.current().match.choosing
        if (c && h.mine(c)) h.send({ defence: { player: c, choice } })
      },
    }))
  }
  return undefined
}
