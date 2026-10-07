---
name: update-agents-docs
description: Keep the agents/ knowledge base, CHANGELOG and skills accurate after changing the Planning App, and sync skills to .claude/skills. Use at the end of any change that alters behaviour, structure, commands or conventions, and whenever the user asks to add or update a skill or docs.
---

# Update the agent docs

`agents/` is the memory of this project. A future agent will trust it, so a stale doc is worse than none.

## Steps

1. **List what changed** that another agent could rely on: commands, file paths, folder layout, module contract, IPC,
   conventions, dependencies, defaults (timings, sizes), known traps.
2. **Update the doc that owns it:**

   | You changed... | Update |
   |---|---|
   | commands, repo map, stack, rules | `agents/README.md` |
   | processes, startup, IPC, security, styling, build pipeline | `agents/ARCHITECTURE.md` |
   | module contract or authoring rules | `agents/MODULES.md` |
   | code style, testing, dependency rules, `data-testid` list | `agents/CONVENTIONS.md` |
   | a feature shipped or the plan changed | `agents/ROADMAP.md` (status table) |
   | you chose between alternatives, or changed a foundation | `agents/DECISIONS.md`: add a **new numbered entry**, do not rewrite old ones (mark an old one "superseded by Dn") |
   | any of the above | `agents/CHANGELOG.md`: one dated line, newest first |

3. **Verify the claims you wrote**: run the command, open the path, check the number. Do not document from memory.
4. **Skills**
   - New or changed skill: edit `agents/skills/<name>/SKILL.md` (front matter `name` and `description` required), update the
     table in `agents/skills/README.md`.
   - Then `npm run skills:sync` and `npm run skills:sync -- --check` (must print "up to date").
5. If you added a file or folder other agents should know about, add it to the repo map in `agents/README.md`.
6. Check links: every relative link in the docs must point at a file that exists.

## Style

- Plain, specific, short. Prefer tables and exact commands to prose. State facts and the reason; avoid "should probably".
- Date entries as `YYYY-MM-DD`. Use real current numbers (sizes, timings) and say when they were measured.
- Write for an agent with no context: spell out file paths, never "as discussed".

## Done when

- Docs match the code, the CHANGELOG has the new line, skills are synced and `--check` passes.
