# A pool-style Shot replaces the radial blast

The ball used to move by a blast: hold a spot on your own half for a 1 s dwell, let power ramp, and on release a radial explosion pushed the ball away from the press. The ball's direction depended on where you pressed relative to it, not on where you wanted it to go, and power was only a matter of holding longer. We replaced it with a pool-style **Shot**: press on the ball, drag back, and release; the ball goes opposite the drag with power from the drag length, through the sim input `shot: { player, dir, tier, power, breaker? }`. Shots come in data-driven tiers, so a careful shot and a risky strong one are a choice, and a Power tier's Splash keeps the area damage the blast used to do.

## Considered Options

- **Keep the blast and add an aim preview.** Rejected: the direction would still come from the press point, so aiming stays indirect on a phone.
- **Pool-style Shot on the ball (chosen).**

## Consequences

- The sim takes a direction and power, not a press origin: the own-half press check and the blast push are gone. `aiming` replaces `charging` as the held input the shot clock can fire.
- The aim gesture is a pure input module (screen pixels in, aim out), wired by the input controller; entities only draw the aim view it publishes, per ADR-0002.
- A press anywhere other than the ball now always pans, since aiming no longer starts off the ball.
