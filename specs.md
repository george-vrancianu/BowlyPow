# BreachBall

A two-player, turn-based pitch game. Blast a ball into the opponent's goal through walls both players build. Playable in the browser on phones, tablets and desktops.

## Platform and scope

- Web first: Vite, TypeScript, Vitest, canvas 2D. Shipped as a PWA, portrait-locked on phones through the manifest. Wrap with Capacitor only if app stores become a requirement.
- Hobby project. Prove the core loop is fun before anything else.
- Milestones, in order:
  1. Core blast-and-build loop with wall durability, hot-seat on one device.
  2. Power-ups.
  3. P2P online play.
- Nothing persists between sessions in v1.

## Architecture

- A pure, deterministic simulation: `step(state, input, config)` returns the new state plus a list of events for that tick. No DOM access and no randomness other than a seeded coin flip. Fixed tick at 60 Hz driven by an accumulator.
- Events carry a moment in time that state alone cannot: ball hit wall (with speed), wall cracked, wall destroyed, blast fired (origin, power), Repulsor fired, Steal triggered, goal, possession changed. The renderer, haptics and a future audio layer consume them. The sim never waits for an animation.
- A renderer that only reads state and events, takes a camera as input, and draws on requestAnimationFrame. Latest sim state only, no interpolation in v1.
- An input layer that turns touches, clicks and keys into sim inputs and camera moves.
- A hot-seat controller feeds both players' inputs into one sim. A P2P peer is just another input source, so P2P is additive.
- Physics is hand-rolled: one ball, static walls, swept circle-vs-segment collision per tick so the ball cannot tunnel through zero-thickness walls at max speed.
- The sim has unit tests from day one. The renderer has none.

## World

- Pitch is 40 units wide by 108 tall, vertical, one goal at each end. Each player owns the half (54 units, 27 cells) nearest their goal.
- Ball radius 1. Grid cell is 2 units (one ball diameter).
- Goal width 10. Goal counts when the ball's center crosses the goal line. Own goals count for the opponent.
- No-build zone: a semicircle of radius 15 (1.5 goal widths) centered on each goal mouth.
- Pitch edges are boards: the ball bounces, there are no throw-ins.

### Physics starting values

Expect to tune friction and max speed by feel in the first hour of play. A full-power hit travels roughly 69 units before resting, so from near your own goal a single shot reaches a little past halfway.

| Parameter | Value |
|---|---|
| Max ball speed | 60 units/s |
| Friction | exponential decay, speed halves every 0.8 s |
| At-rest threshold | 0.5 units/s |
| Wall and edge restitution | 0.85 |

## Camera

- The view is always the full 40-unit pitch width. Visible height is whatever the screen gives, capped at 64 units, so a player sees their own half plus a 10-unit strip of the enemy's. Nobody ever sees more than that at once.
- Screens taller than 10:16 get letterbox bands top and bottom. Screens wider than 10:16 get a 10:16 pane letterboxed left and right. The HUD lives in the bands.
- The camera targets the ball, clamped so it never shows beyond the boards. While the ball moves it follows with about 150 ms of smoothing lag. At rest it settles on the ball.
- Free panning at all times, in every phase: drag during the blast dwell (see Blasting), or drag with two fingers. Mouse drag and mouse wheel on desktop. A manual pan holds until the next sim event (blast fired, wall placed, possession change), then the camera returns to the ball. A recenter button in the HUD does the same on demand. Panning never pauses the shot clock.
- Map: a HUD button opens a full-screen live view of the whole pitch, drawn by the same renderer through a second camera, with the current view outlined. Tap any point to close the map and center the camera there. Close button or map button closes without moving. A fit/stretch toggle in the corner is remembered for the session. The clock keeps running. Available in every phase, including the opponent's turn and while the ball moves.
- A soft gradient at the view edge shows when more pitch lies beyond it.
- Camera is renderer state. The sim never knows about it.

## Game modes

Match-level rules belong to a game mode (see `docs/adr/0001-game-mode-abstraction.md`); the sim config names it. The settings screen has a mode picker above the sliders, Siege is the default, and only the sliders a mode uses are shown (no rounds slider in Siege). Online matches run Siege on default settings.

### Siege

- No score and no rounds. One opening build phase with the Rounds ordering (coin-flip loser builds first, the winner gets ball-in-hand), then play; there are no further build phases.
- A goal emits the goal event, resets the ball to the pitch center and gives the conceder ball-in-hand with a fresh shot counter. Own goals count for the opponent.
- There is no shot cap: shots never end anything.
- The HUD shows no score digit and no round label.
- The match has no end condition yet.
- Wall points default to 10; a value to tune after play-testing.

### Rounds

The match structure below is Rounds.

- Pre-match settings screen with three sliders: shots per possession (default 3), rounds (default 5), wall points per build phase (default 10).
- A match is a fixed number of rounds. Most goals after all rounds wins. If tied, sudden-death rounds with no shot cap until someone scores.
- Each round is a build phase followed by a play phase.
- A round ends on a goal or after 30 total shots (scoreless).
- Round start: the player who conceded the last goal gets ball-in-hand on their own half. Round 1, or after a scoreless round, a coin flip decides.

## Build phase

- Open information: both players see everything. Players build one after the other. Round 1 order is the coin-flip loser first, then order alternates each round.
- Each player gets the configured wall points (default 10). Unspent points are lost, no carry-over.
- A "Done" button ends your build. No timer in hot-seat (add one for P2P). Tapping Done with nothing placed skips the phase.
- Walls persist for the whole match.
- Placement: tap a shape in the palette, a ghost appears on your half, drag the ghost to position it (dragging elsewhere pans), tap Rotate, tap Confirm. The ghost turns red where placement is illegal.
- Walls snap to the grid and rotate in 90-degree steps. No diagonals in v1.
- Walls may touch or overlap each other, so L shapes can form boxes.
- Placement is illegal on the opponent's half, inside your own no-build zone, or if it would make your goal unreachable (see below).
- Demolishing your own wall costs 1 point and refunds nothing. You cannot demolish the opponent's walls.
- The camera starts centered on your own half at the beginning of your build turn.

### Shapes and costs

| Shape | Geometry | Cost |
|---|---|---|
| Straight wall | 4 cells in a line | 2 |
| L wall | 3 cells + 3 cells at a right angle | 3 |

Other shapes and diagonals are v2.

### Reachability rule

A placement is rejected if, after it, a ball-sized disc could no longer travel from the halfway line to the goal mouth. Implemented as a grid flood fill. Towers count as obstacles. The check never needs to re-run when walls are destroyed, since removal only opens paths.

### Wall durability

- Every wall has 3 hit points. An L wall is one object with one pool.
- A ball hitting a wall at more than 50% of max speed removes 1 hit point.
- Blasts also damage structures, see Blasting.
- At 0 the wall disappears mid-shot and the ball continues at reduced speed.
- Cracks show the damage. No refund on destruction.

## Play phase

### Possession

- The player whose half the ball is resting on has the shot.
- Each possession starts with the configured number of shots (default 3).
- After every shot the ball must come to rest before anything else happens. Only the resting position matters, not the path.
- If the ball rests on the opponent's half, possession switches and the opponent's counter resets.
- If the ball rests on the shooter's half, the counter decrements. At 0 the opponent gets ball-in-hand on the opponent's half with a fresh counter.
- A ball whose center rests exactly on the halfway line stays with the shooter and burns a shot.

### Ball-in-hand

- Place the ball anywhere on your own half where it does not overlap a wall or tower. The ball's center must be strictly on your side of the halfway line. The no-build zone does not apply.
- Tap a legal point to place the ghost ball, drag the ghost to move it (dragging elsewhere pans), tap Confirm to fix it. The ghost goes red where placement is illegal.

### Shot clock

- One 15-second clock per shot, starting when the shot (or ball-in-hand) is granted. It covers placement and the shot. The clock turns red and pulses for the last 5 seconds.
- On expiry: if a blast is charging, it fires at its current power. Otherwise one shot is burned and the ball stays put. If the ball was not yet placed, it is placed at the center of the shooter's half first.
- A second consecutive expiry by the same player in the same possession hands possession to the opponent as ball-in-hand.

### Blasting

- A blast is an explosion centered on the touch point. It may start anywhere on the shooter's own half that is not on a wall, tower or the ball. Never on the opponent's half.
- Touch and hold still for 1 second (the dwell). Moving more than 12 pixels during the dwell turns the gesture into a camera pan. Releasing during the dwell is a free cancel: nothing fires, no shot is burned.
- After the dwell, power ramps from 0 to 100% over 1.5 seconds with a quadratic ease-in (slow at first, fast at the end), then holds at 100%. Moving more than 12 pixels after the ramp starts cancels the blast for free and kills the gesture until the finger lifts; it never becomes a pan.
- Blast radius grows with power from 1 ball diameter at the start of the ramp to 5 ball diameters (10 units) at full power.
- Release fires. Everything inside the radius is pushed away from the center. Strength falls off linearly from full at the center to zero at the edge. The ball is pushed only if it is inside the radius.
- A blast that does not reach the ball still counts as one of the possession's shots.
- Blast damage: pressure at a structure's nearest point is power × (1 − distance / radius). Enemy structures lose 1 HP above 0.4 and 2 HP above 0.8. The shooter's own structures lose 1 HP above 0.8 only. The halfway line shields nothing: a blast near the line damages what it reaches on the far side. Towers use the same rule with their own HP.
- Starting values, tune by feel.

### Hot-seat handover

- At every possession change and at ball-in-hand the screen flips 180 degrees so the active player is always at the bottom.
- A "Player N's turn" overlay appears for 1 second and the next player taps it to dismiss before they can act. The camera re-centers on the ball behind the overlay.

## Power-ups (milestone 2)

- Each player starts the match with 3 of each power-up. No economy. Counts are visible to both players.
- Towers follow all wall rules: own half only, outside the no-build zone, counted in the reachability check, persistent across rounds, placed in the build phase through the same ghost-drag-rotate-confirm flow. They cost 0 wall points; the power-up is the cost.

### Breaker shot (play phase)

- Tap the Breaker icon to arm, then charge as normal. A cancelled charge disarms without consuming it.
- Consumed when the blast fires, whether or not the ball hits anything.
- The ball destroys the first wall or tower it touches, including your own, then continues at full speed.
- A Steal tower hit by a Breaker is destroyed without triggering.
- The Breaker and the blast explosion are separate mechanics; the explosion damages as usual.

### Repulsor tower (build phase)

- 1-cell square obstacle with 3 hit points.
- When the ball touches it, the ball is fired away at max speed along the reflected direction.
- Fires once per shot, then acts as a plain wall until the ball comes to rest. Triggers for either player's shot.

### Steal tower (build phase)

- 1-cell square obstacle with 1 hit point.
- Triggers only on the opponent's shot: the ball stops dead and the tower's owner gets ball-in-hand with a fresh counter.
- For the owner's own shots it is a plain wall.
- Consumed when it triggers.

## Presentation

### Visual language

- Minimal flat rendering: solid fills, thin dark outlines on walls and ball, no sprites. Glow is reserved for the charge circle, Repulsor fire and goals.
- Dark night pitch with a lighter board around it. Player 1 cyan, Player 2 orange, ball white, off-white UI text. Player 2 walls carry a diagonal hatch so ownership survives colour-blindness. Your own half has a very faint tint of your colour so you always know which half you are looking at while panning.
- Everything a player owns (walls, towers, goal line, HUD strip) carries their colour. Towers differ from walls by glyph, not colour.
- Juice level: moderate. Hit flashes, particles, shockwave rings and screen shake, all renderer-only. No slow motion, no hit-stop.

### Pitch markings

- Halfway line always visible.
- Grid dots at cell corners and the no-build arc (dashed, in the builder's colour) during build only.
- Goal is a gap in the board with a thick line in the defending player's colour and a shallow net box behind it where a scored ball visibly lands.

### Ball

- A short fading trail of ghost discs at previous positions, length proportional to speed, gone at rest.
- A single darker dot on the disc that orbits with distance travelled so the ball appears to roll. No squash.

### Charge and blast

- During the dwell: a thin pulsing ring in the player's colour under the finger.
- During the ramp: the ring fills and shifts toward red as power grows, with radar-style rings sweeping outward. Structures inside the circle are tinted red, own structures darker red, so own-wall damage is always a visible choice.
- A faint arrow on the ball shows the push direction.
- On release: the circle collapses, a shockwave ring expands to the blast radius over 250 ms and fades, the screen shakes with amplitude scaled by power (max about 4 px, 200 ms, none below 30% power).

### Walls and towers

- Damaging hit: wall flashes white for 100 ms with a few particles in its colour at the contact point. Non-damaging hit: dimmer, shorter flash, no particles.
- One jagged crack line per lost HP, deterministic from wall id and HP so P2P peers draw the same cracks.
- Destruction: the wall splits into cell-sized fragments that fly from the impact point, spin and fade over 400 ms.
- Repulsor: square with two concentric rings. On fire the rings burst outward, the tower glows for 300 ms and the ball's trail brightens for 0.5 s. Drawn dimmed once spent for the shot.
- Steal: square with a vortex glyph. On trigger the ball shrinks into the tower center over 300 ms and vanishes, then the tower collapses like a destroyed wall.
- Breaker armed: HUD icon highlighted and a pulsing outline on the ball in the shooter's colour. On break, double particles, no speed loss.

### Ghosts and buttons

- Wall and ball ghosts are half-transparent in the owner's colour, red when illegal.
- One button-row component serves both phases. Build: palette (Straight, L, Repulsor, Steal, each with cost or remaining count, selected item highlighted), Rotate, Confirm, Done. Ball-in-hand: Confirm.

### Transitions

- Handover flip: animated 180-degree rotation over 400 ms, with the turn overlay fading in during the second half so nobody sees the pitch upside-down.
- Goal: 1.5 s hold with a full-width "GOAL" banner in the scorer's colour, the scoreboard digit flipping, the ball resting in the net. Then the normal handover.
- Build and play: a 1 s "BUILD" or "PLAY" label sweeping across the pitch.
- All interstitials are one overlay component. In round 1 only, turn overlays carry short hints ("Hold on the pitch to charge a blast").

### HUD

- System font stack, bold weights, uppercase labels, tabular numerals.
- Each player's strip sits at their own end of the pitch in their colour: score as a large number, three power-up icons with count badges (dimmed at 0; Breaker tappable only during your own play phase).
- Shared items sit in the larger letterbox band: round as "ROUND 2 / 5", shot clock as a number with a draining ring, shots remaining as three dots that empty, phase label, map button and recenter button (grouped together, thumb-reachable on a phone). On wide screens the strips move to the side bands.
- The HUD rotates with the flip so the active player's strip is always at the bottom.

### Screens

- Title screen (name, Play), settings screen (three sliders, Start), match end screen (winner in their colour, final score, Rematch, Menu). Same flat style and font. No tutorial screen in v1.

### Feedback and accessibility

- No sound in v1. The event list exists so an audio layer can subscribe later without touching the renderer.
- Haptics through the Vibration API where supported: short pulse on blast release scaled by power, double pulse on goal, single tick when charge reaches 100%.
- Reduced-motion preference disables screen shake, particles, the flip rotation (instant cut with the overlay) and haptics. Functional visuals such as the charge circle and ghosts stay.
- Desktop keys: M map, Space recenter, R rotate, Enter confirm, Esc close map or cancel ghost.
- App icon: a white ball with a cyan-to-orange shockwave ring on the pitch colour, one SVG source exported to the required PNG sizes. Splash is the dark background with the title.

## P2P (milestone 3)

- WebRTC between two browsers. Signaling via a tiny server or a pasted connection string, to be decided then.
- Each peer runs the same deterministic sim and exchanges one input per shot or placement. Inputs are small integers thanks to the grid; a blast is an origin point and a power value.
- Each player sees the pitch with themselves at the bottom.
- Add a build-phase timer for P2P. A hidden-walls mode is possible only in P2P and is a later idea.

## Deferred ideas

- Points economy: buying power-ups with points earned from goals or from defensive play.
- Point-generating tower and a tower that throws the ball in a chosen direction.
- Earned power-ups (one per goal) if fixed allotments make matches feel samey.
- Pickups spawned on the pitch.
- Diagonal walls and additional shapes.
- Realtime simultaneous play.
- Pinch zoom, frame interpolation on high-refresh screens, sound.
