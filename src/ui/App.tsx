import { useEffect, useRef, useState } from 'react'
import { Game, type HudView } from '../game/Game'
import { Shell } from './hud/Shell'
import { Overlay } from './overlays/Overlay'
import { MatchEndScreen, SettingsScreen, TitleScreen } from './screens/Screens'

type Screen = 'title' | 'settings' | 'end' | undefined

/** Owns the canvas, the Game and the HUD view. Game pushes the view up; the layers drive it back through `actions`. */
export function App() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game>(null)
  const [view, setView] = useState<HudView>()
  // The match runs behind the title; the end screen shows when a match is won while no screen is up.
  const [screen, setScreen] = useState<Screen>('title')

  useEffect(() => {
    const g = new Game(canvas.current!, setView)
    game.current = g
    document.getElementById('splash')?.remove()
    return () => g.destroy()
  }, [])

  useEffect(() => {
    if (view?.winner && !screen) setScreen('end')
  }, [view?.winner, screen])

  const actions = () => game.current!.actions
  // The finished match's view lingers until the next frame; clear its winner so the end screen does not reopen.
  const leaveMatch = (next: Screen) => (setView((v) => v && { ...v, winner: undefined }), setScreen(next))

  return (
    <>
      {/* The stage rotates as one: canvas, in-match HUD and overlay (the 180-degree handover flip). */}
      <div style={{ position: 'fixed', inset: 0, transform: `rotate(${view?.angle ?? 0}deg)` }}>
        <canvas ref={canvas} />
        {view && (
          <>
            <Shell
              hud={view.hud}
              menu={view.menu}
              confirm={view.confirm}
              mapOpen={view.mapOpen}
              flipped={view.flipped}
              onMap={() => actions().map()}
              onRecenter={() => actions().recenter()}
              onPowerUp={(p) => actions().powerUp(p)}
              onConfirm={() => actions().confirmBall()}
              onMapStretch={() => actions().mapStretch()}
              onMapClose={() => actions().map(false)}
              onBuildToggle={() => actions().build.toggle()}
            />
            <Overlay view={view.overlay} onTap={() => actions().dismiss()} />
          </>
        )}
      </div>
      {screen === 'title' && <TitleScreen onPlay={() => setScreen('settings')} />}
      {screen === 'settings' && <SettingsScreen onStart={(s) => (actions().start(s), leaveMatch(undefined))} />}
      {screen === 'end' && view?.winner && <MatchEndScreen winner={view.winner} result={view.result} onRematch={() => (actions().rematch(), leaveMatch(undefined))} onMenu={() => leaveMatch('title')} />}
    </>
  )
}
