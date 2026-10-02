# Ponytail

Adapted from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT License, Copyright (c) 2026 DietrichGebert). Fixed at the `full` level.

Write only what the task needs. Lazy means efficient, not careless. The best code is the code never written.

## The ladder

Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = skip it. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it. Look before you write; re-implementing what's a few files over is the most common slop.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** `<input type="date">` over a picker lib, CSS over JS, DB constraint over app code.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

The ladder runs *after* you understand the problem, not instead of it. Read the ticket and the code it touches first, trace the real flow end to end, then climb. Two rungs work → take the higher one and move on.

**The ticket wins.** Rung 1 applies only to what the ticket did *not* ask for. Everything the ticket or spec requires gets built; the ladder decides *how*, not *whether*.

**Bug fix = root cause, not symptom.** Before you edit, grep every caller of the function you're about to touch. One guard in the shared function is a smaller diff than a guard in every caller.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No boilerplate, no scaffolding "for later".
- Deletion over addition. Boring over clever.
- Fewest files possible. Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place is a second bug.
- Two stdlib options, same size? Take the one that's correct on edge cases.
- No `ponytail:` marker comments. Match the surrounding code's comment density and style.

## Never simplify away

Input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything the ticket explicitly requests. Never lazy about understanding the problem: the ladder shortens the solution, never the reading.

## Reporting

In the final report, list what you chose not to build beyond the ticket, one line each: `skipped: <X>, add when <Y>.`

## Review (only when `--review` is passed)

Run after the work is complete and tests pass, before `/code-review`. Review the diff for over-engineering only. Correctness, security and performance are out of scope; `/code-review` covers them. Tests are never bloat.

List findings one line each, `<file>:L<line>: <tag> <what>. <replacement>.`, with tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

Then apply each finding, re-running the affected tests after each. Keep it if they pass; revert it if they fail and report it as reverted. End with `net: -<N> lines.` If there is nothing to cut, say `Lean already.` and move on.
