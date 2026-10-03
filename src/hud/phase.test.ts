import { describe, expect, it } from 'vitest'
import { defaultConfig as c, type SimInput, type SimState } from '../sim/step'
import { buildState } from '../sim/testkit'
import { phaseButtons } from './phase'

/** Hot-seat: one device, so every seat is "mine". */
const hotSeat = () => true

describe('phase buttons in hot-seat', () => {
  it('Done sends the current builder even when the button was created for the previous one', () => {
    let state: SimState = buildState(1)
    const sent: SimInput[] = []
    // The HUD only rebuilds its row when a label or disabled flag changes, so this first row keeps serving clicks.
    const [done] = phaseButtons(state, c, { mine: hotSeat, current: () => state, send: (i) => sent.push(i) })!
    done!.onClick()
    expect(sent).toEqual([{ done: 1 }])

    state = buildState(2)
    expect(state.match.builder).toBe(2)
    done!.onClick()
    expect(sent.at(-1)).toEqual({ done: 2 })
  })
})
