// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { HudView } from '../game/Game'

// Game needs a real canvas; the seam under test is how App creates, feeds and drives it.
const games = vi.hoisted(() => [] as { destroyed: boolean; onView: (v: HudView) => void; actions: Record<string, ReturnType<typeof vi.fn>> }[])
vi.mock('../game/Game', () => ({
  Game: class {
    destroyed = false
    actions = { start: vi.fn(), rematch: vi.fn(), map: vi.fn() }
    constructor(_canvas: HTMLCanvasElement, public onView: (v: HudView) => void) {
      games.push(this)
    }
    destroy() {
      this.destroyed = true
    }
  },
}))

import { App } from './App'

const view = (over: Partial<HudView> = {}): HudView => ({
  size: { width: 400, height: 800 },
  hud: { players: { 1: { digit: '0', inventory: { breaker: 1, repulsor: 1, steal: 1 } }, 2: { digit: '0', inventory: { breaker: 1, repulsor: 1, steal: 1 } } }, active: 1, round: 1, rounds: 5, clock: null, shotsLeft: 3, shotsMax: 3, phase: 'Play', breaker: { armed: false, tappable: false } },
  angle: 0, flipped: false, confirm: false, mapOpen: false, result: '', ...over,
})

beforeEach(() => (games.length = 0))
afterEach(cleanup)

it('mounting under StrictMode leaves one running Game, and unmounting stops it', () => {
  const { unmount } = render(<StrictMode><App /></StrictMode>)
  expect(games.filter((g) => !g.destroyed)).toHaveLength(1)
  unmount()
  expect(games.filter((g) => !g.destroyed)).toHaveLength(0)
})

it('rotates the in-match stage with the view angle', () => {
  const { container } = render(<App />)
  act(() => games[0]!.onView(view({ angle: 180, flipped: true })))
  expect((container.querySelector('canvas')!.parentElement as HTMLElement).style.transform).toBe('rotate(180deg)')
})

it('plays from title through settings into a match, then offers match end once and rematch', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  fireEvent.click(screen.getByText('Start'))
  const game = games[0]!
  expect(game.actions.start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'siege' }))
  expect(screen.queryByText('Start')).toBeNull()

  act(() => game.onView(view({ winner: 1, result: '2 structures left' })))
  expect(screen.getByText('Player 1 wins')).toBeTruthy()
  fireEvent.click(screen.getByText('Rematch'))
  expect(game.actions.rematch).toHaveBeenCalled()
  expect(screen.queryByText('Player 1 wins')).toBeNull()
})

it('Menu returns to the title and the finished match does not pop the end screen back up', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  fireEvent.click(screen.getByText('Start'))
  act(() => games[0]!.onView(view({ winner: 2, result: 'x' })))
  fireEvent.click(screen.getByText('Menu'))
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  act(() => games[0]!.onView(view({ winner: 2, result: 'x' })))
  expect(screen.queryByText('Player 2 wins')).toBeNull()
})
