import { buttonRow, el, FONT, type ButtonSpec } from '../hud/hud'
import { PLAYER_COLORS } from '../sim/player'
import { defaultSettings, MODES, SLIDERS, slidersFor, type Settings } from '../sim/settings'
import type { PlayerId } from '../sim/pitch'

/** The mode picker's buttons: the chosen mode reads as pressed (aria-pressed and a filled look), not just bracketed text. */
export const modePicker = (current: Settings['mode'], pick: (mode: Settings['mode']) => void): ButtonSpec[] => MODES.map(({ mode, label }) => ({ label, pressed: mode === current, onClick: () => pick(mode) }))

export type ScreenActions = { onStart(s: Settings): void; onRematch(): void; onMenu(): void; onOnline(): void }

/** Full-screen overlays outside the match, in the HUD's flat style. Each call replaces the previous screen. */
export function createScreens(root: HTMLElement, actions: ScreenActions) {
  const settings: Settings = { ...defaultSettings }
  const overlay = el('div', `${FONT}position:fixed;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#0b0f1a;color:#e8eaf0;`)
  root.append(overlay)

  const show = (...children: HTMLElement[]) => {
    overlay.replaceChildren(...children)
    overlay.style.display = 'flex'
  }

  const settingsScreen = () => {
    const picker = buttonRow(modePicker(settings.mode, (mode) => ((settings.mode = mode), settingsScreen())))
    const rows = slidersFor(settings.mode).map((k) => {
      const { label, min, max } = SLIDERS[k]
      const value = el('span', '', String(settings[k]))
      const input = el('input', 'width:100%;min-height:44px;') as HTMLInputElement
      Object.assign(input, { type: 'range', min, max, step: 1, value: settings[k], ariaLabel: label })
      input.oninput = () => (value.textContent = String((settings[k] = input.valueAsNumber)))
      const head = el('div', 'display:flex;justify-content:space-between;')
      head.append(el('span', '', label), value)
      const row = el('div', 'width:min(80vw,320px);')
      row.append(head, input)
      return row
    })
    show(el('div', 'font-size:28px;', 'Settings'), picker, ...rows, buttonRow([{ label: 'Start', onClick: () => (overlay.style.display = 'none', actions.onStart({ ...settings })) }]))
  }

  const title = () =>
    show(el('div', 'font-size:12vw;font-weight:800;letter-spacing:0.05em;', 'BreachBall'), buttonRow([{ label: 'Play', onClick: settingsScreen }, { label: 'Online', onClick: actions.onOnline }]))

  const hide = () => (overlay.style.display = 'none')
  const menu = { label: 'Menu', onClick: () => (title(), actions.onMenu()) }
  /** A message with a way back to the title (e.g. the opponent disconnected). */
  const notice = (text: string) => show(el('div', 'font-size:24px;', text), buttonRow([menu]))

  const matchEnd = (winner: PlayerId, result: string, online = false) =>
    show(
      el('div', `font-size:32px;color:${PLAYER_COLORS[winner]};`, `Player ${winner} wins`),
      el('div', 'font-size:48px;', result),
      buttonRow(online ? [menu] : [{ label: 'Rematch', onClick: () => (hide(), actions.onRematch()) }, menu]),
    )

  return { title, matchEnd, notice, hide, settings }
}
