import type { PlayerId } from '../sim/pitch'
import type { SimInput } from '../sim/step'

/** What a peer tells the other each tick: its input (if any) for sim tick `t`. */
export type Frame = { t: number; i?: SimInput }

const isEmpty = (i: SimInput) => Object.keys(i).length === 0

/**
 * Delay lockstep: an input submitted now runs `delay` ticks ahead on both sides, and a tick only runs once the
 * other peer's frame for it has arrived. No state is ever sent; the sim is deterministic, so inputs are enough.
 */
export function lockstep(send: (f: Frame) => void, me: PlayerId, delay = 10) {
  const local = new Map<number, SimInput>()
  const remote = new Map<number, SimInput>()
  for (let t = 0; t < delay; t++) local.set(t, {}), remote.set(t, {})
  let pending: SimInput = {}
  let n = 0
  return {
    /** Queue this peer's input for the next frame it sends. */
    submit(i: SimInput) {
      pending = { ...pending, ...i }
    },
    receive(f: Frame) {
      remote.set(f.t, f.i ?? {})
    },
    /** The merged input for the next tick, or undefined while the other peer's frame is missing. */
    advance(): SimInput | undefined {
      if (!local.has(n + delay)) {
        local.set(n + delay, pending)
        send(isEmpty(pending) ? { t: n + delay } : { t: n + delay, i: pending })
        pending = {}
      }
      const theirs = remote.get(n)
      if (!theirs) return undefined
      const mine = local.get(n)!
      local.delete(n)
      remote.delete(n)
      n++
      return me === 1 ? { ...mine, ...theirs } : { ...theirs, ...mine }
    },
  }
}
