import { visual } from '../config/visual'
import type { OverlayView } from '../game/view/transition'

/** The one interstitial component: turn card, GOAL banner, BUILD/PLAY/REPAIRED sweep and the REVEAL and "Opponent is choosing" labels (pinned to the top, no band, so the pitch stays visible). Mount inside the rotating stage; call `update` every frame (undefined hides it). */
export function createOverlay(root: HTMLElement, onTap: () => void) {
  const e = document.createElement('div')
  e.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;font:800 9vmin system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-transform:uppercase;'
  const text = document.createElement('div')
  const hint = document.createElement('div')
  hint.style.cssText = `font:600 3.5vmin system-ui,sans-serif;text-transform:none;color:${visual.hud.ink};`
  e.append(text, hint)
  e.onpointerdown = onTap
  root.append(e)
  return {
    update(v: OverlayView | undefined) {
      e.style.display = v ? 'flex' : 'none'
      if (!v) return
      const banner = v.band
      const top = v.placement === 'top'
      text.textContent = v.text
      hint.textContent = v.hint ?? ''
      Object.assign(e.style, {
        justifyContent: top ? 'flex-start' : 'center',
        opacity: String(v.opacity),
        pointerEvents: v.kind === 'sweep' || v.kind === 'notice' ? 'none' : 'auto',
        color: v.color,
        background: top || banner ? 'transparent' : visual.hud.scrim,
        transform: v.kind === 'sweep' ? `translateX(${(0.5 - v.progress) * 200}%)` : '',
      })
      // Pinned labels sit below the HUD strip so they never cover its digit and badges.
      text.style.cssText = top ? `padding:1vmin 3vmin;margin-top:max(19vmin,112px);background:${visual.hud.scrimLight};border-radius:1vmin;font-size:6vmin;` : banner ? `width:100%;padding:2vmin 0;background:${visual.hud.scrim};${v.kind === 'goal' ? `border-block:1vmin solid ${v.color};` : ''}` : ''
    },
  }
}
