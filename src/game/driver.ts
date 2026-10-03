import { initialState, step, type SimConfig, type SimEvent, type SimInput, type SimState } from '../sim/step'

/** Where a driver delivers sim state: `Game`. A blocked sink (a flip, goal hold or turn card) makes the driver stop stepping. */
export type Sink = { apply(state: SimState, events: SimEvent[]): void; blocked(): boolean }

/** How `Game` sends local inputs to whatever runs the match. */
export type Driver = { send(input: SimInput): void }

/** Hot-seat: runs the sim on this device at its tick rate. The only place `step` is called. */
export class LocalDriver implements Driver {
  private state!: SimState
  private config!: SimConfig
  private pending: SimInput = {}
  private charging?: SimInput['charging']
  private acc = 0

  constructor(private sink: Sink) {}

  /** A new match; the sink gets the first state from the caller. */
  start(config: SimConfig, seed?: number): SimState {
    this.config = config
    this.pending = {}
    this.charging = undefined
    this.acc = 0
    return (this.state = initialState(seed, config))
  }

  /** One-off inputs go to the next tick; `charging` holds until it is sent again (undefined releases it). */
  send(input: SimInput): void {
    const { charging, ...rest } = input
    if ('charging' in input) this.charging = charging
    this.pending = { ...this.pending, ...rest }
  }

  /** Advances by `dt` seconds, stepping whole ticks and handing each to the sink. */
  update(dt: number): void {
    const tick = 1 / this.config.tickHz
    this.acc += dt
    for (; this.acc >= tick; this.acc -= tick) {
      if (this.sink.blocked()) {
        this.pending = {}
        continue
      }
      const out = step(this.state, this.charging ? { charging: this.charging, ...this.pending } : this.pending, this.config)
      this.state = out.state
      this.pending = {}
      this.sink.apply(out.state, out.events)
    }
  }
}
