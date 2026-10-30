# StackPick

A tech stack recommender. Describe your project idea, fill in a short form, and get a
ranked stack with reasons, alternatives, cost and difficulty estimates, an architecture
diagram and a learning roadmap.

**Live demo:** https://ahmad-ausaf0.github.io/stackpick/

Built with Angular 19 + Tailwind CSS. The rule-based engine runs fully client-side from
a local data file, no backend or API keys needed. An optional AI mode sends your idea +
constraints to an LLM (your own OpenAI-compatible key) and renders its structured answer.

## Run it

```bash
npm install
npm start        # dev server on http://localhost:4200
npm run build    # production build in dist/stackpick
```

## How it works

- `src/app/data/tech.ts` is the catalog: ~50 technologies across frontend, backend,
  database, auth, hosting and extras, each tagged with learning curve, scalability,
  ecosystem strength, dev velocity, monthly cost and the features it covers.
- `src/app/services/stack.service.ts` is the rule-based scoring engine. It scores every
  candidate against your constraints (project type, scale, team experience, budget,
  timeline, must-have features, preferred tools) and adds a small coherence bonus so you
  don't end up with a Firebase backend and a Supabase auth layer.
- `Compare stacks` re-scores the same inputs under three priority profiles:
  Fast & simple, Balanced, Scale-ready.

## AI mode (optional)

Next to the rule-based engine there is an **AI mode**. Flip it on in step 2, fill in an
OpenAI-compatible endpoint (base URL, model, API key — OpenAI, Groq, OpenRouter or a
local server all work), and StackPick sends your idea + constraints to the model and
renders its stack in the same UI.

- The request asks for strict JSON with a fixed schema; the answer is parsed defensively
  (fences stripped, shape validated field by field) before it reaches the UI.
- If the model returns an incomplete or malformed stack, or the call fails, the app
  falls back to the rule-based pick and says so.
- Your key is stored only in your browser's localStorage and requests go straight from
  your browser to the provider; nothing touches any StackPick backend (there isn't one).

## Features

- Three-step wizard (idea, requirements, result) with progress indicator and example chips
- Top pick + reason + alternatives for every category, plus extras (payments, storage,
  realtime, search, notifications, CI/CD, monitoring)
- "Why this stack?" summary tied to your inputs, pros and cons, difficulty rating,
  estimated monthly cost range
- SVG architecture diagram generated from the picks
- Learning roadmap tuned to your experience and timeline
- Save recommendations to localStorage, re-open or delete them later
- Export as Markdown (download) or PDF (print view)
- Dark/light mode, mobile-first layout
