import { visual } from '../config/visual'
import { buttonRow, el, FONT } from '../hud/hud'
import { SLIDERS, type Settings } from '../sim/settings'
import type { PlayerId } from '../sim/pitch'

export type ScreenActions = { onStart(s: Settings): void; onRematch(): void; onMenu(): void }

/** Full-screen overlays outside the match, in the HUD's flat style. Each call replaces the previous screen. */
export function createScreens(root: HTMLElement, actions: ScreenActions) {
  const settings: Settings = { shots: SLIDERS.shots.def, rounds: SLIDERS.rounds.def, wallPoints: SLIDERS.wallPoints.def }
  const overlay = el('div', `${FONT}position:fixed;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:${visual.hud.dark};color:${visual.hud.ink};`)
  root.append(overlay)

  const show = (...children: HTMLElement[]) => {
    overlay.replaceChildren(...children)
    overlay.style.display = 'flex'
  }

  const settingsScreen = () => {
    const rows = (Object.keys(SLIDERS) as (keyof Settings)[]).map((k) => {
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
    show(el('div', 'font-size:28px;', 'Settings'), ...rows, buttonRow([{ label: 'Start', onClick: () => (overlay.style.display = 'none', actions.onStart({ ...settings })) }]))
  }

  const title = () =>
    show(el('div', 'font-size:12vw;font-weight:800;letter-spacing:0.05em;', 'BreachBall'), buttonRow([{ label: 'Play', onClick: settingsScreen }]))

  const hide = () => (overlay.style.display = 'none')
  const menu = { label: 'Menu', onClick: () => (title(), actions.onMenu()) }

  const matchEnd = (winner: PlayerId, score: Record<PlayerId, number>) =>
    show(
      el('div', `font-size:32px;color:${visual.player.colors[winner]};`, `Player ${winner} wins`),
      el('div', 'font-size:48px;', `${score[1]} - ${score[2]}`),
      buttonRow([{ label: 'Rematch', onClick: () => (hide(), actions.onRematch()) }, menu]),
    )

  return { title, matchEnd }
}
