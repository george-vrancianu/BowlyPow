import type { PlayerId } from '../sim/pitch'
import type { SimInput } from '../sim/step'

/** A peer's input (if any) for sim tick `t`. Frames arrive in order, so `t` also says it has no other input before `t`. */
export type Frame = { t: number; i?: SimInput }

type Charging = NonNullable<SimInput['charging']>
const isEmpty = (i: SimInput) => Object.keys(i).length === 0
/** How far ahead an idle peer promises "no input" in one frame. */
const PROMISE = 6

/**
 * Delay lockstep: an input submitted now runs at least `delay` ticks ahead on both sides, and a tick only runs once the
 * other peer has promised nothing else for it. No state is ever sent; the sim is deterministic, so inputs are enough.
 * A frame is sent per input, or once per `PROMISE` ticks to keep the other peer running.
 */
export function lockstep(send: (f: Frame) => void, me: PlayerId, delay = 6) {
  const inputs: Record<'mine' | 'theirs', Map<number, SimInput>> = { mine: new Map(), theirs: new Map() }
  // Ticks before `delay` are empty on both sides.
  let promised = delay - 1
  let heard = delay - 1
  let pending: SimInput = {}
  let n = 0
  // A charge stays in force until its owner changes it (power 0) or fires; the sim reads it only on shot-clock expiry.
  const charges: Partial<Record<PlayerId, Charging>> = {}
  const take = (who: 'mine' | 'theirs', player: PlayerId) => {
    const { charging, ...rest } = inputs[who].get(n) ?? {}
    inputs[who].delete(n)
    if (charging) charges[player] = charging.power > 0 ? charging : undefined
    if (rest.blast) charges[player] = undefined
    return rest
  }
  return {
    /** Queue this peer's input for the next frame it sends. */
    submit(i: SimInput) {
      pending = { ...pending, ...i }
    },
    receive(f: Frame) {
      if (f.i) inputs.theirs.set(f.t, f.i)
      heard = Math.max(heard, f.t)
    },
    /** The merged input for the next tick (with the shooter's held charge), or undefined while the other peer is not caught up. */
    advance(shooter: PlayerId): SimInput | undefined {
      if (!isEmpty(pending)) {
        promised = Math.max(n + delay, promised + 1)
        inputs.mine.set(promised, pending)
        send({ t: promised, i: pending })
        pending = {}
      } else if (promised < n + delay) {
        promised = n + delay + PROMISE - 1
        send({ t: promised })
      }
      if (heard < n) return undefined
      const [mine, theirs] = [take('mine', me), take('theirs', me === 1 ? 2 : 1)]
      n++
      const charging = charges[shooter]
      return { ...(me === 1 ? { ...mine, ...theirs } : { ...theirs, ...mine }), ...(charging && { charging }) }
    },
  }
}
