# Skills

Skills are short playbooks for recurring tasks. Each is a folder `agents/skills/<name>/` with a `SKILL.md`
(YAML front matter with `name` and `description`, then Markdown instructions), the same format Claude Code uses.

**Source of truth: `agents/skills/`.** Claude Code only looks in `.claude/skills/`, so `npm run skills:sync` mirrors
every skill there (and marks the copies with a `.synced-from-agents` file). Never edit `.claude/skills/` by hand;
`npm run skills:sync -- --check` fails if the copy is stale.

## Current skills

| Skill | Use it when |
|---|---|
| [add-module](add-module/SKILL.md) | adding any new feature, page or capability to the app |
| [run-and-verify](run-and-verify/SKILL.md) | checking that a change really works: typecheck, tests, launching the app, screenshots |
| [package-exe](package-exe/SKILL.md) | producing the Windows installer or an unpacked `.exe` |
| [update-agents-docs](update-agents-docs/SKILL.md) | finishing a change: updating these docs, the changelog and the skills |

## Adding a skill

1. Create `agents/skills/<kebab-case-name>/SKILL.md`:

   ```markdown
   ---
   name: <kebab-case-name>
   description: <one or two sentences: what it does and exactly when to use it. This text decides when the skill triggers.>
   ---

   # <Title>

   ## Steps
   1. ...

   ## Done when
   - ...
   ```

2. Write steps an agent can follow without extra context: exact commands, file paths, what "done" looks like. Reference
   the other docs by path instead of copying them. Supporting files (templates, scripts) may sit in the same folder and are
   copied along.
3. Add a row to the table above.
4. Run `npm run skills:sync`, then `npm run skills:sync -- --check`.
5. Add a line to [../CHANGELOG.md](../CHANGELOG.md).

Good candidates as the app grows: `add-claude-feature` (calling the Claude API from a module), `add-slide-element`,
`import-pdf-pipeline`, `release-checklist`.
