// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverlayView } from '../../game/view/transition'
import { Overlay } from './Overlay'

afterEach(cleanup)
const view = (over: Partial<OverlayView> = {}): OverlayView => ({ kind: 'turn', placement: 'center', band: false, text: 'Player 2', hint: 'Drag back from the ball to shoot', color: '#fff', opacity: 1, progress: 0, dismissable: true, ...over })

it('renders nothing without a view', () => {
  const { container } = render(<Overlay onTap={() => {}} />)
  expect(container.firstChild).toBeNull()
})

it('shows text and hint, and a tap dismisses a turn card', () => {
  const tap = vi.fn()
  render(<Overlay view={view()} onTap={tap} />)
  expect(screen.getByText('Drag back from the ball to shoot')).toBeTruthy()
  fireEvent.pointerDown(screen.getByText('Player 2'))
  expect(tap).toHaveBeenCalled()
})

it('lets taps through sweeps and the choosing notice', () => {
  const { container, rerender } = render(<Overlay view={view({ kind: 'sweep' })} onTap={() => {}} />)
  expect((container.firstChild as HTMLElement).style.pointerEvents).toBe('none')
  rerender(<Overlay view={view({ kind: 'notice', text: 'Opponent is choosing' })} onTap={() => {}} />)
  expect((container.firstChild as HTMLElement).style.pointerEvents).toBe('none')
  expect(screen.getByText('Opponent is choosing')).toBeTruthy()
})
