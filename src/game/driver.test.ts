import { describe, expect, it } from 'vitest'
import { defaultConfig, type SimEvent, type SimState } from '../sim/step'
import { LocalDriver } from './driver'

function setup(blocked = false) {
  const ticks: { state: SimState; events: SimEvent[] }[] = []
  const sink = { apply: (state: SimState, events: SimEvent[]) => ticks.push({ state, events }), blocked: () => blocked }
  const driver = new LocalDriver(sink)
  const start = driver.start(defaultConfig, 1)
  return { driver, ticks, start }
}
const tick = 1 / defaultConfig.tickHz

describe('LocalDriver', () => {
  it('steps whole ticks at the sim tick rate and hands each to the sink', () => {
    const { driver, ticks } = setup()
    driver.update(tick * 3.5)
    expect(ticks.map((t) => t.state.tick)).toEqual([1, 2, 3])
    driver.update(tick * 0.5)
    expect(ticks).toHaveLength(4)
  })

  it('feeds a sent input into the next tick: Done ends the builder\'s turn', () => {
    const { driver, ticks, start } = setup()
    driver.send({ done: start.match.builder! })
    driver.update(tick)
    expect(ticks[0].state.match.builder).not.toBe(start.match.builder)
  })

  it('stops stepping while the sink is blocked and drops what was sent meanwhile', () => {
    const { driver, ticks } = setup(true)
    driver.send({ done: 1 })
    driver.update(tick * 5)
    expect(ticks).toHaveLength(0)
  })
})
