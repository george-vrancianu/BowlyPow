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
