# CLAUDE.md — chemowell-app-beta (APP-BETA)

**THIS FILE MUST BE CALLED `CLAUDE.md`. The instructions live in `claude/chemowell-app-beta.md`.**

Aaron, 2026-09-13: *"I think it's also worth looking into renaming all the cloud.md files based on
which app it's tied to. For example, Claude/caretracker.md"*

He is right about the goal and the obvious way to get there is the bug. **Claude Code auto-loads a
file named exactly `CLAUDE.md` (or `.claude/CLAUDE.md`), and nothing else** — which is precisely why
this repo's rules sat unread in `APP_CLAUDE.md` for months while the only instructions in play were
another patient's app. Renaming to `claude/chemowell-app-beta.md` and stopping there would recreate
that failure exactly.

So the name goes on the file, and this stub imports it. `@path` imports are a supported feature:
relative to the file containing them, recursive to four hops, loaded in full at launch. The content
is in a file named for its app; the loader still finds it.

@./claude/chemowell-app-beta.md
