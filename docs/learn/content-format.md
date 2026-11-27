# Learn app — lesson format

One folder per domain, level and language: `learn/content/<domain>/<level>.<lang>/`.

- `_domain.yaml` — `domain`, `graph` (path to the domain's `graph.yaml`), `level`, `language`, `title`,
  `tagline`, and short `applications` labels.
- `_start.yaml` — the starter lesson; `teaches:` lists every primitive in the graph.
- `<concept_id>.yaml` — one lesson per concept in the graph: `title`, `summary` (one plain sentence shown on the map), `minutes`, `cards`, `review`. The starter also has `summaries` for each primitive.

## Cards
| type | fields | learner does |
|---|---|---|
| `hook` | `text`, `reveal` | reads a question, taps *Show me* |
| `idea` | `text`, optional `svg` | reads one idea |
| `steps` | `title`, `problem`, `steps[]`, optional `svg` | reveals a worked example step by step |
| `predict` | `q`, `options[]`, `reveal` | guesses, then sees the answer (not graded) |
| `choice` | `q`, `options[]` (`text`, `correct: true` + `why`, or `feedback`) | picks one (graded) |
| `number` | `q`, `answer`, `formula`, `explain`, optional `tolerance`, `unit`, `hint` | types a number (graded) |
| `order` | `q`, `items[]` in the right order, `explain` | taps the items in order (graded) |
| `build` | — | picks the concept's building blocks; generated from the graph's `composed_of` (graded) |

`review` holds `choice`, `number` or `order` questions used for spaced reviews.

Text supports `**bold**`, `*italics*`, blank-line paragraphs and `- ` bullet lists. Diagrams are inline SVG;
use the classes `a` (accent), `soft`, `faint`, `thick` and `dot`, so they follow light and dark mode.

## Checks
`python scripts/learn/build_lessons.py` validates every folder and writes `public/learn/*.json`. It fails if a
concept has no lesson, a choice question doesn't have exactly one right answer, a wrong option has no
feedback, a numeric `answer` doesn't match its `formula` (recomputed), or a diagram isn't safe, well-formed SVG.
