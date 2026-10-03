// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../game/view/settings'
import { MatchEndScreen, SettingsScreen, TitleScreen } from './Screens'

afterEach(cleanup)

it('title offers Play', () => {
  const play = vi.fn()
  render(<TitleScreen onPlay={play} />)
  fireEvent.click(screen.getByText('Play'))
  expect(play).toHaveBeenCalled()
})

it('settings: the mode picker and sliders report changes, and Start fires', () => {
  const [change, start] = [vi.fn(), vi.fn()]
  const { rerender } = render(<SettingsScreen settings={defaultSettings} onChange={change} onStart={start} />)
  expect(screen.getByText('Siege').getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByLabelText(/rounds/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Rounds' }))
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'rounds' }))
  const settings = { ...defaultSettings, mode: 'rounds' as const }
  rerender(<SettingsScreen settings={settings} onChange={change} onStart={start} />)
  const rounds = screen.getByLabelText(/rounds/i) as HTMLInputElement
  fireEvent.change(rounds, { target: { value: rounds.max } })
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'rounds', rounds: Number(rounds.max) }))
  fireEvent.click(screen.getByText('Start'))
  expect(start).toHaveBeenCalled()
})

it('settings: the On time out toggle shows in both modes and reports the choice', () => {
  for (const mode of ['siege', 'rounds'] as const) {
    const change = vi.fn()
    render(<SettingsScreen settings={{ ...defaultSettings, mode }} onChange={change} onStart={() => {}} />)
    expect(screen.getByText('On time out')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Shoot' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Burn' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Burn' }))
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ mode, expiry: 'burn' }))
    cleanup()
  }
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
