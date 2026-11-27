# ConceptBook Learn — a bite-sized learning app on the concept graph

A phone-first app that teaches a domain one concept at a time, in the order the concept graph allows,
using short interactive sessions designed for people with short attention spans.

## Why the graph matters
The `graph.yaml` already says which concepts each concept is built from. That gives the app, for free:
- **What's ready to learn:** a concept unlocks once everything it's built from is learned.
- **What to learn next:** among ready concepts, the one that unlocks the most (the same "reach" rule as
  `graph_lib.productivity_order`).
- **"Build it" activities:** pick the building blocks of a concept from the graph's `composed_of`.
- **Why it matters:** each concept shows what it unlocks, all the way to real applications.

## The learner's loop
1. **Map** — the domain as a skill tree, level by level. Learned concepts are lit, ready ones glow,
   the rest are locked. Applications sit at the bottom as goals.
2. **Lesson** (3–5 minutes, one concept): hook → one idea (with a picture) → worked example revealed step
   by step → your turn → build-it → quick check → the concept lights up on the map.
3. **Reviews** — each learned concept comes back as a 30-second question after 1, 3, 7, 16, 35 days.
   Review sessions mix concepts. Wrong answers bring the review back sooner.

## Learning-science principles → features
| Principle | Feature |
|---|---|
| Retrieval practice (testing beats re-reading) | Every lesson ends with questions; reviews are questions, not re-reading |
| Spaced repetition | Review schedule above |
| Cognitive load | One idea per card; prerequisites enforced by the graph |
| Worked examples, then fading | Steps revealed one at a time, then a similar problem to do alone |
| Immediate, specific feedback | Every wrong option explains the misconception behind it |
| Mastery learning | A concept counts as learned only after the check is answered correctly (misses are retried) |
| Dual coding | A diagram on idea and example cards |
| Curiosity | Lessons open with a question, not a definition |
| Interleaving | Review sessions mix concepts |
| Small visible wins | Progress bar per lesson, a concept lights up, weekly practice dots |

**For short attention spans:** something to tap or decide every 30–60 seconds; no long scrolling; stop any
time and resume on the same card; an optional "one more?" at the end; gentle streaks (days practised this
week rather than a streak that breaks).

## Content
Lessons live in `learn/content/<domain>/<level>.<lang>.yaml` (human-editable). `scripts/learn/build_lessons.py`
validates them against the graph and **recomputes every numeric answer** from a formula stored with the
question, then writes `public/learn/<domain>.<level>.<lang>.json`. Version 1: Geometry, core level,
English, written and checked by hand with AI help; an LLM generator that follows the same format comes later.

## Technical shape
- `learn/index.html` + `learn/src/` — a second Vite entry (plain JavaScript, like the rest of the site),
  served at `/concept-book/learn/`.
- Installable web app (manifest + service worker; works offline after the first visit). iPhone: Safari →
  Share → Add to Home Screen.
- Progress is stored on the device (localStorage). Nothing is sent anywhere.
- Hosted on GitHub Pages with the rest of the site.

## Milestones
- **v1 (Geometry):** content format + checker, Geometry lessons, map, lesson player with 6 activity types,
  reviews, progress, install + offline.
- **v2:** accounts + sync across devices, push reminders for reviews, more domains, LLM lesson generator
  with the same checks, a "teacher review" pass before lessons go live.
- **Measure:** delayed-review accuracy (remembered after a week), not just lessons finished.
