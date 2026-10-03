# BreachBall

A two-player pitch game: build structures, then blast a ball into the opponent's goal. A game mode decides how a match is won.

## Language

**Rounds**:
The game mode where a match is a series of rounds, each with its own build phase, decided by score after the configured number of rounds (a tie goes to sudden death).
_Avoid_: Classic, standard mode

**Siege**:
The game mode with no score and no rounds: each player builds once, then play continues, a goal handing the conceder ball-in-hand at the pitch center.
_Avoid_: Endless mode, sandbox

**Game mode**:
The set of rules that owns a match's match-level transitions: how it starts, what a goal and a consumed shot do, and who has won.
_Avoid_: Variant, ruleset

**Defence turn**:
The scorer's reward for a goal in Siege: after the GOAL banner they choose how to improve their defence (Repair, later Rearrange) before the conceder gets ball-in-hand. An own goal gives it to the opponent of the shooter.
_Avoid_: Bonus turn, power-up

**Repair**:
The defence-turn choice that restores every surviving structure the scorer owns to full HP; destroyed structures stay gone.
_Avoid_: Heal, rebuild
**Wipe-out**:
Siege's end condition: a player owns no structures (towers included) when the ball comes to rest or a goal is scored, never mid-flight. If both players are at zero, the shooter loses.
_Avoid_: Elimination, knockout

**Blind build**:
Siege's opening build, during which each viewer sees only their own half; the opponent's structure count, tower stock and build points are hidden. Hiding is renderer and HUD only, the sim state is complete.
_Avoid_: Hidden build, secret build

**Fog**:
The renderer's cover over the opponent's half (up to the halfway line, boards and nets included) during a blind build, in the main view and the map.
_Avoid_: Mask, blackout
