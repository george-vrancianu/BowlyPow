// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MatchEndScreen, SettingsScreen, TitleScreen } from './Screens'

afterEach(cleanup)

it('title offers Play', () => {
  const play = vi.fn()
  render(<TitleScreen onPlay={play} />)
  fireEvent.click(screen.getByText('Play'))
  expect(play).toHaveBeenCalled()
})

it('settings: the mode picker swaps the sliders and Start hands over the choices', () => {
  const start = vi.fn()
  render(<SettingsScreen onStart={start} />)
  expect(screen.getByText('Siege').getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByLabelText(/rounds/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Rounds' }))
  expect(screen.getByRole('button', { name: 'Rounds' }).getAttribute('aria-pressed')).toBe('true')
  const rounds = screen.getByLabelText(/rounds/i) as HTMLInputElement
  fireEvent.change(rounds, { target: { value: rounds.max } })
  fireEvent.click(screen.getByText('Start'))
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'rounds', rounds: Number(rounds.max) }))
})

it('match end names the winner and offers rematch and menu', () => {
  const [rematch, menu] = [vi.fn(), vi.fn()]
  render(<MatchEndScreen winner={2} result="1 structure left" onRematch={rematch} onMenu={menu} />)
  expect(screen.getByText('Player 2 wins')).toBeTruthy()
  expect(screen.getByText('1 structure left')).toBeTruthy()
  fireEvent.click(screen.getByText('Rematch'))
  fireEvent.click(screen.getByText('Menu'))
  expect([rematch, menu].map((f) => f.mock.calls.length)).toEqual([1, 1])
})
