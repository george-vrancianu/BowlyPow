# Game modes are objects with pure hooks over a discriminated match state

Siege is a second way to decide a match, so match-level transitions (start, goal, shot consumed, winner) move out of the step function into a game mode object with pure hooks that return match state plus events. Match state is a union keyed by `mode`, and the sim config names the mode. The step function keeps physics, possession, build turns and the shot clock.

## Considered Options

- **A mode string with branches inside step.** Rejected: every new mode adds if-branches through the step function.
- **Separate step functions sharing physics helpers.** Rejected: possession, shot clock and build turn logic would be duplicated or threaded through helpers, and lockstep determinism would have two paths to keep in sync.
- **Mode object with pure hooks (chosen).** One step function; a mode implements `start`, `onShotFired`, `onShotConsumed`, `onGoal`, `onBuildDone`, `onBuildStart` and `winner`. Every hook except `start` and `onShotFired` also gets a read-only context (`objects`, `possession`) so a mode can judge the board without branches in step. `onBuildDone` may refuse (null) and emit events; `onBuildStart` says what a new build turn looks like (wall points, which structures are movable). Step calls `winner` whenever a shot is consumed or a goal is scored, whether or not the hook returned a result, and ends the match itself.

## Consequences

- Rounds behaviour is unchanged; its logic lives in `src/sim/mode.ts`.
- Reading per-mode match fields (round, score) requires narrowing on `match.mode`.
- A new mode adds a union member and a hooks object, not branches in step. Step dispatches on `state.match.mode`; only `initialState` reads `config.mode`.
- The hooks must stay pure so the sim remains deterministic for lockstep.
