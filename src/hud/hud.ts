import { visual } from '../config/visual'
import { layout } from '../render/camera'
import { type PowerUp } from '../sim/player'
import type { PlayerId } from '../sim/pitch'

export type Band = { x: number; y: number; w: number; h: number }

/** The two letterbox bands around the pane. The active player's strip (and the shared strip) sits in `near`: bottom on tall screens, right on wide ones. */
export function bands(size: { width: number; height: number }): { near: Band; far: Band; wide: boolean } {
  const { pane } = layout(size)
  const wide = pane.x > pane.y
  const { width: W, height: H } = size
  return wide
    ? { wide, far: { x: 0, y: 0, w: pane.x, h: H }, near: { x: pane.x + pane.w, y: 0, w: pane.x, h: H } }
    : { wide, far: { x: 0, y: 0, w: W, h: pane.y }, near: { x: 0, y: pane.y + pane.h, w: W, h: pane.y } }
}

export type HudModel = {
  players: Record<PlayerId, { score: number; inventory: Record<PowerUp, number> }>
  /** Whose turn it is; their strip goes to the bottom. */
  active: PlayerId
  round: number
  rounds: number
  /** Seconds left and fraction of the clock remaining, or null when no clock runs. */
  clock: { seconds: number; fraction: number } | null
  shotsLeft: number
  shotsMax: number
  phase: string
  /** Phase buttons (Done in a build turn) shown under the shared strip; rebuilt only when labels or state change. */
  buttons?: ButtonSpec[]
  /** Breaker is armed (highlighted) and whether the active player may tap it now. */
  breaker: { armed: boolean; tappable: boolean }
}

export type HudActions = { onMap(): void; onRecenter(): void; onPowerUp?(p: PowerUp): void }

export type ButtonSpec = { label: string; onClick(): void; disabled?: boolean }

const ICONS: Record<PowerUp, string> = { breaker: 'B', repulsor: 'R', steal: 'S' }
export const el = (tag: string, css = '', text = '') => {
  const e = document.createElement(tag)
  e.style.cssText = css
  e.textContent = text
  return e
}
export const FONT = 'font:700 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-transform:uppercase;font-variant-numeric:tabular-nums;'

/** One row of buttons, shared by the phase buttons and the strip. */
export function buttonRow(specs: ButtonSpec[]): HTMLElement {
  const row = el('div', 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;')
  for (const s of specs) {
    const b = el('button', `${FONT}min-width:44px;min-height:44px;padding:0 14px;border-radius:8px;border:2px solid ${visual.hud.ink};color:${visual.hud.ink};background:${visual.hud.panel};opacity:${s.disabled ? 0.4 : 1};`, s.label) as HTMLButtonElement
    b.disabled = !!s.disabled
    b.onclick = s.onClick
    row.append(b)
  }
  return row
}

const ring = (f: number, color: string = visual.hud.ink) => `conic-gradient(${color} ${f * 360}deg,${visual.hud.track} 0)`

/** DOM overlay mounted over the canvas; call `update` every frame with the current model and canvas size. */
export function createHud(root: HTMLElement, actions: HudActions) {
  const mk = (id: PlayerId) => {
    const color = visual.player.colors[id]
    const strip = el('div', `${FONT}display:flex;align-items:center;justify-content:center;gap:16px;color:${color};`)
    const score = el('div', 'font-size:40px;line-height:1;')
    const icons = (Object.keys(ICONS) as PowerUp[]).map((p) => {
      const b = el('button', `${FONT}position:relative;width:44px;height:44px;border-radius:50%;border:2px solid ${color};color:${color};background:none;`, ICONS[p]) as HTMLButtonElement
      const badge = el('span', `position:absolute;top:-6px;right:-6px;min-width:18px;border-radius:9px;background:${color};color:${visual.hud.dark};font-size:12px;`)
      b.append(badge)
      b.onclick = () => actions.onPowerUp?.(p)
      return { p, b, badge }
    })
    strip.append(score, ...icons.map((i) => i.b))
    return { strip, score, icons }
  }
  const strips = { 1: mk(1), 2: mk(2) }
  const round = el('div')
  const clockNum = el('div', `width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${visual.hud.dark};position:relative;`)
  const dots = el('div', 'display:flex;gap:4px;')
  const phase = el('div')
  const buttons = buttonRow([
    { label: 'Map', onClick: () => actions.onMap() },
    { label: 'Recenter', onClick: () => actions.onRecenter() },
  ])
  const phaseRow = el('div')
  let phaseKey = ''
  const shared = el('div', `${FONT}display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;color:${visual.hud.ink};`)
  shared.append(round, clockNum, dots, phase, buttons, phaseRow)
  const near = el('div', 'position:fixed;display:flex;flex-direction:column;justify-content:space-around;gap:8px;')
  const far = el('div', 'position:fixed;display:flex;flex-direction:column;justify-content:center;')
  root.append(near, far)

  function update(m: HudModel, size: { width: number; height: number }) {
    const b = bands(size)
    const put = (e: HTMLElement, r: Band) => Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
    // Player 2's view is rotated 180 degrees, so the active strip and shared band take the far geometry.
    put(near, m.active === 2 ? b.far : b.near)
    put(far, m.active === 2 ? b.near : b.far)
    const [own, other] = [strips[m.active], strips[m.active === 1 ? 2 : 1]]
    near.replaceChildren(shared, own.strip)
    far.replaceChildren(other.strip)
    for (const id of [1, 2] as const) {
      const s = strips[id]
      const p = m.players[id]
      if (s.score.textContent !== String(p.score)) {
        if (s.score.textContent) s.score.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], 400)
        s.score.textContent = String(p.score)
      }
      for (const i of s.icons) {
        const n = p.inventory[i.p]
        i.badge.textContent = String(n)
        const breaker = i.p === 'breaker'
        const live = id === m.active && m.breaker.tappable
        i.b.style.opacity = n > 0 ? '1' : '0.35'
        i.b.style.background = breaker && id === m.active && m.breaker.armed ? visual.player.colors[id] : 'none'
        i.b.style.color = breaker && id === m.active && m.breaker.armed ? visual.hud.dark : visual.player.colors[id]
        i.b.disabled = breaker && !live
      }
    }
    round.textContent = `Round ${m.round} / ${m.rounds}`
    clockNum.textContent = m.clock ? String(Math.ceil(m.clock.seconds)) : '-'
    const urgent = !!m.clock && m.clock.seconds <= visual.hud.urgentSeconds
    clockNum.style.background = ring(m.clock?.fraction ?? 0, urgent ? visual.hud.urgent : undefined)
    clockNum.style.transform = urgent ? `scale(${1 + visual.hud.urgentPulse * Math.abs(Math.sin(Math.PI * m.clock!.seconds))})` : ''
    dots.replaceChildren(...Array.from({ length: m.shotsMax }, (_, i) => el('span', `width:12px;height:12px;border-radius:50%;border:2px solid ${visual.hud.ink};background:${i < m.shotsLeft ? visual.hud.ink : 'none'};`)))
    phase.textContent = m.phase
    const key = JSON.stringify((m.buttons ?? []).map(({ label, disabled }) => [label, disabled]))
    if (key !== phaseKey) {
      phaseKey = key
      phaseRow.replaceChildren(...(m.buttons?.length ? [buttonRow(m.buttons)] : []))
    }
  }
  return { update }
}
