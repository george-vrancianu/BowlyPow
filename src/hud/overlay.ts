import type { overlayView } from './transition'

type View = NonNullable<ReturnType<typeof overlayView>>

/** The one interstitial component: turn card, GOAL banner, BUILD/PLAY/REPAIRED sweep and the REVEAL label (pinned to the top, no band, so the pitch stays visible). Mount inside the rotating stage; call `update` every frame (undefined hides it). */
export function createOverlay(root: HTMLElement, onTap: () => void) {
  const e = document.createElement('div')
  e.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;font:800 9vmin system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-transform:uppercase;'
  const text = document.createElement('div')
  const hint = document.createElement('div')
  hint.style.cssText = 'font:600 3.5vmin system-ui,sans-serif;text-transform:none;color:#e8eaf0;'
  e.append(text, hint)
  e.onpointerdown = onTap
  root.append(e)
  return {
    update(v: View | undefined) {
      e.style.display = v ? 'flex' : 'none'
      if (!v) return
      const banner = v.band
      text.textContent = v.text
      hint.textContent = v.hint ?? ''
      Object.assign(e.style, {
        justifyContent: v.placement === 'top' ? 'flex-start' : 'center',
        opacity: String(v.opacity),
        pointerEvents: v.kind === 'sweep' ? 'none' : 'auto',
        color: v.color,
        background: v.kind === 'reveal' ? 'transparent' : banner ? 'transparent' : 'rgba(11,15,26,0.85)',
        transform: v.kind === 'sweep' ? `translateX(${(0.5 - v.progress) * 200}%)` : '',
      })
      text.style.cssText = v.kind === 'reveal' ? 'padding:1vmin 3vmin;margin-top:10vmin;background:rgba(11,15,26,0.7);border-radius:1vmin;font-size:6vmin;' : banner ? `width:100%;padding:2vmin 0;background:rgba(11,15,26,0.85);${v.kind === 'goal' ? `border-block:1vmin solid ${v.color};` : ''}` : ''
    },
  }
}
