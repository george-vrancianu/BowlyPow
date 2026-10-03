import { type CSSProperties, type ReactNode } from 'react'
import { visual } from '../../config/visual'
import type { PlayerId } from '../../game/Game'
import { modePicker, sliderRows, type Settings } from '../../game/view/settings'
import { ButtonRow, FONT } from '../ButtonRow'

type Look = { className?: string; style?: CSSProperties; children?: ReactNode }

/** A full-screen layer outside the match, in the HUD's flat style. */
function Screen({ className, style, children }: Look) {
  return (
    <div className={className} style={{ ...FONT, position: 'fixed', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: visual.hud.dark, color: visual.hud.ink, ...style }}>
      {children}
    </div>
  )
}

export function TitleScreen({ onPlay, ...look }: { onPlay(): void } & Look) {
  return (
    <Screen {...look}>
      <div style={{ fontSize: '12vw', fontWeight: 800, letterSpacing: '0.05em' }}>BreachBall</div>
      <ButtonRow specs={[{ label: 'Play', onClick: onPlay }]} />
      {look.children}
    </Screen>
  )
}

/** The mode picker, then the sliders that mode uses, then Start. */
export function SettingsScreen({ settings, onChange, onStart, ...look }: { settings: Settings; onChange(s: Settings): void; onStart(): void } & Look) {
  return (
    <Screen {...look}>
      <div style={{ fontSize: 28 }}>Settings</div>
      <ButtonRow specs={modePicker(settings.mode, (mode) => onChange({ ...settings, mode }))} />
      {sliderRows(settings).map(({ key, label, min, max, value }) => (
        <label key={key} style={{ display: 'block', width: 'min(80vw,320px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <input type="range" min={min} max={max} step={1} value={value} aria-label={label} style={{ width: '100%', minHeight: 44 }} onChange={(e) => onChange({ ...settings, [key]: e.currentTarget.valueAsNumber })} />
        </label>
      ))}
      <ButtonRow specs={[{ label: 'Start', onClick: onStart }]} />
      {look.children}
    </Screen>
  )
}

export function MatchEndScreen({ winner, result, onRematch, onMenu, ...look }: { winner: PlayerId; result: string; onRematch(): void; onMenu(): void } & Look) {
  return (
    <Screen {...look}>
      <div style={{ fontSize: 32, color: visual.player.colors[winner] }}>{`Player ${winner} wins`}</div>
      <div style={{ fontSize: 48 }}>{result}</div>
      <ButtonRow specs={[{ label: 'Rematch', onClick: onRematch }, { label: 'Menu', onClick: onMenu }]} />
      {look.children}
    </Screen>
  )
}
