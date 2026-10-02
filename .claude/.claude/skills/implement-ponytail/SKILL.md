---
name: implement-ponytail
description: "Implement a piece of work based on a spec or set of tickets, writing only the code the task needs (ponytail rules). Pass --review for an extra over-engineering pass."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Before writing any code, read [PONYTAIL.md](PONYTAIL.md) and apply it to everything you build.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

If the user passed `--review`, run the Review section of [PONYTAIL.md](PONYTAIL.md) once the full test suite passes.

Once done, use /code-review to review the work.

Commit your work to the current branch.
