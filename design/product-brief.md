# Product spec

## One line
A Windows desktop app that learns how a teacher makes her slides, builds new lessons in that style from her learning objectives, and lets her refine them by chatting and by circling parts of a slide.

## Who it's for
- **The teacher** (secondary science in the examples; called "Alice" in mockups and the code's splash). She has years of decks she made herself, mostly in PowerPoint, some saved as PDF. She knows her style (colours, fonts, Do Now, tick-box objectives, key word chips, mini-whiteboard prompts) and wants it kept, not replaced by generic AI slides. She isn't technical.
- **The builder** (the person setting it up and adding features over time). Wants new features to drop in as plugins.

## Goals
1. A ready-to-teach lesson in her style in **under 5 minutes** from pasting objectives.
2. Changes feel like talking to a helpful colleague: "make this simpler", or circle it and say "swap this for a diagram".
3. Everything ends up as a normal **PowerPoint file** she can teach from.
4. New capabilities arrive as plugins in the **+** menu, without redesigning screens.

## Non-goals (v1)
- Accounts, sharing or multi-teacher use (everything is local on her PC).
- Marking, grading, student data or mark schemes.
- Editing arbitrary existing `.pptx` files in place (importing them as new lessons comes later).
- Mobile.
- Using a Claude Pro/Max subscription. Anthropic doesn't allow it in third-party apps; see `claude-access.md`.

## Screens (direction B · Classroom)

| # | Screen | Image | Spec |
|---|---|---|---|
| 1 | Welcome (first run) | `images/01-welcome.png` | `screens/01-welcome.md` |
| 2 | Connect Claude (first run + Settings › AI) | `images/02-connect-claude.png` | `screens/02-connect-claude.md` |
| 3 | Home: new lesson, your styles, past lessons | `images/03-home.png` | `screens/03-home.md` |
| 4 | Create a style | `images/04-create-style.png` | `screens/04-create-style.md` |
| 5 | New lesson (empty editor) | `images/05-new-lesson.png` | `screens/05-new-lesson.md` |
| 6 | Editor: chat, circle-to-edit, + menu | `images/06-editor.png` | `screens/06-editor.md` |
| 7 | Plugin options sheet (Quiz) | `images/07-plugin-sheet.png` | `screens/07-plugin-sheet.md` |

Interactive prototype: the design canvas (links between screens work in Play mode), or open `mockups/Welcome.html` in a browser and click through.

## Features and requirements

### F1. First run
- On first launch, after the splash: **Welcome** (name, subject) → **Connect Claude** (API key, test, model) → **Create your first style** (can be skipped) → Home.
- The name replaces the hard-coded splash name ("Welcome Alice").
- Skipping Connect Claude is allowed. AI actions then show a "Connect Claude" prompt instead of failing.

### F2. Styles ("teach it my style")
- Create a style by dropping **PDF and/or PowerPoint** files (up to 50) on Home or in Create a style.
- Watch it learn: per-file status (Waiting → Reading… → Learned / Couldn't read), progress bar and time estimate. "What I've learned so far" fills in live: colours with roles, fonts, layout habits, slide types she uses, how she writes, and a **test slide**.
- Name the style; make it the default; fix mistakes in plain words ("I never use yellow on title slides").
- Several styles are allowed (e.g. Science KS3, Form time). Each lesson remembers its style.
- Privacy: tell her what is sent to Claude, and warn if slides seem to contain pupil names.
- Details: `style-profile.md`.

### F3. Making a lesson
- From Home's **Make a new lesson** card, or **New lesson** anywhere: paste objectives or upload the LO document (Word, PDF, PowerPoint). Choose style, length, year group, ability and roughly how many slides.
- **Make my slides**: a plan, then the slides appear one by one in the filmstrip, with progress in the chat.
- The lesson title is filled in automatically and editable.
- Details: `ai-pipeline.md` §4.

### F4. Refining
- **Chat** with the planning buddy in the right panel. Every AI change is one undo step, shown as a result chip with **Undo**.
- **Circle to edit:** draw a loop round anything on a slide. It becomes a numbered region chip attached to the next message. Several regions are allowed.
- **Direct edits:** select, type into text, move, delete, reorder slides by dragging, add a slide. Basic only in v1; the chat does the heavy lifting.
- **Undo / redo** across everything, including after restarting the app.

### F5. Plugins (the + menu)
- v1 plugins, in order: Quiz, Speaker notes, Differentiate, Starter & plenary, Worksheet.
- Details and how to add more: `plugin-architecture.md`.

### F6. Library
- Home's **Past lessons**: cards with a first-slide thumbnail, title, year chip, slide count, last edited. Filter by year, sort, search (lessons and styles).
- Card menu: Open, Duplicate, Rename, Export to PowerPoint, Delete (with confirmation; deleted lessons go to the Recycle Bin, or are kept 30 days).

### F7. Export & present
- **Export to PowerPoint** (`.pptx`) through a Save dialog, then **Open in PowerPoint**. Details: `deck-model.md` §5.
- **Present:** full-screen slideshow from the app's own renderer (arrow keys, Esc).

### F8. Settings
- Your name, subject.
- AI: key (replace / remove), model, test, and "This month: about $X" usage.
- Default style, plugins on/off.

## Release plan
- **MVP (v0.5):** F1, F2, F3, F4 without direct-manipulation editing, F7 export, F6 basic grid.
- **v1:** + circle to edit polish, Quiz + Speaker notes plugins, Present, library filters/search, usage display.
- **v1.x:** remaining plugins, importing an old `.pptx` as an editable lesson, image search/upload in slides, PowerPoint bridge for exact previews (see code ROADMAP).

Step-by-step order for the coding agents: `build-plan.md`.

## Success measures (ask the teacher)
- Generated lessons need **≤ 5 edits** before she'd teach them.
- She says "that looks like mine" for most slides.
- Time from objectives to an exported deck: **under 10 minutes** including edits.
