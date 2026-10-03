import { layout } from '../render/camera'
import type { BuildMenu } from './build'
import { el, FONT, type ButtonSpec } from './hud'

const ROUND = `${FONT}width:52px;height:52px;border-radius:50%;border:2px solid #e8eaf0;color:#e8eaf0;background:#141a2a;font-size:22px;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 2px 8px #0008;`
// A small brick wall.
const ICON = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="1"/><path d="M2 9.3h20M2 14.7h20M8 4v5.3M16 4v5.3M12 9.3v5.4M8 14.7V20M16 14.7V20"/></svg>'

// Drawn rather than an emoji, which some fonts lack.
const GLYPHS: Record<string, { svg: string; aria: string }> = { '🗑': { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>', aria: 'Demolish' } }

const button = (s: ButtonSpec, css: string) => {
  const b = el('button', `${css}opacity:${s.disabled ? 0.4 : 1};`, s.label) as HTMLButtonElement
  const g = GLYPHS[s.label]
  if (g) (b.innerHTML = g.svg), b.setAttribute('aria-label', g.aria)
  b.disabled = !!s.disabled
  b.onclick = s.onClick
  return b
}

/** The floating build menu at the builder's bottom-right of the pane; `update(undefined)` hides it. */
export function createFab(root: HTMLElement) {
  const box = el('div', 'position:fixed;z-index:5;display:flex;flex-direction:column;align-items:flex-end;gap:10px;')
  root.append(box)
  let key = ''
  function update(m: BuildMenu | undefined, toggle: () => void, size: { width: number; height: number }, flipped: boolean) {
    box.style.display = m ? 'flex' : 'none'
    if (!m) return void (key = '')
    // The stage turns 180 degrees when player 2 is shown, so their bottom-right is the pane's top-left in stage space.
    const { pane } = layout(size)
    const inset = 16
    Object.assign(box.style, flipped
      ? { left: `${pane.x + inset}px`, top: `${pane.y + inset}px`, right: '', bottom: '', flexDirection: 'column-reverse', alignItems: 'flex-start' }
      : { left: '', top: '', right: `${size.width - pane.x - pane.w + inset}px`, bottom: `${size.height - pane.y - pane.h + inset}px`, flexDirection: 'column', alignItems: 'flex-end' })
    const specs = m.kind === 'menu' ? m.items : m.buttons
    const k = JSON.stringify([m.kind, m.kind === 'menu' && m.open, specs.map(({ label, disabled }) => [label, disabled])])
    if (k === key) return
    key = k
    if (m.kind === 'selected') {
      const row = el('div', 'display:flex;gap:10px;')
      row.append(...m.buttons.map((s) => button(s, ROUND)))
      return box.replaceChildren(row)
    }
    const icon = el('button', ROUND) as HTMLButtonElement
    icon.innerHTML = m.open ? '✕' : ICON
    icon.setAttribute('aria-label', m.open ? 'Close build menu' : 'Build')
    icon.onclick = toggle
    const items = m.open ? m.items.map((s) => button(s, `${FONT}min-height:44px;padding:0 14px;border-radius:22px;border:2px solid #e8eaf0;color:#e8eaf0;background:#141a2a;`)) : []
    box.replaceChildren(...items, icon)
  }
  return { update }
}
