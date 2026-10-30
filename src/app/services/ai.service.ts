import { Injectable } from '@angular/core';
import {
  Constraints, StackRec, CategoryPick, ExtraPick, RoadmapStep,
} from './stack.service';
import { CAT_LABELS, EXTRA_CATS, FEATURE_LIST, Tech, ProjectType, FeatureId } from '../data/tech';

export interface AiSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
};

const VALID_CATS = ['frontend', 'backend', 'database', 'auth', 'hosting'];
const VALID_EXTRA_CATS = ['payments', 'storage', 'realtime', 'search', 'notifications', 'cicd', 'monitoring'];

/** The shape we ask the LLM for. Everything is re-validated before use. */
interface AiCategory {
  cat: string;
  name: string;
  reason: string;
  note?: string;
  url?: string;
  alternatives?: string[];
}
interface AiRec {
  difficulty: string;
  difficultyNote?: string;
  cost?: number[];
  costNote?: string;
  why?: string[];
  pros?: string[];
  cons?: string[];
  categories: AiCategory[];
  extras?: AiCategory[];
  roadmap?: { title: string; detail: string }[];
}

const SYSTEM_PROMPT = `You are StackPick, a pragmatic senior software architect.
Given a project idea and constraints, recommend a coherent, realistic tech stack.
Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:

{
  "difficulty": "Easy" | "Medium" | "Hard",
  "difficultyNote": "one sentence",
  "cost": [minMonthlyUsd, maxMonthlyUsd],
  "costNote": "one sentence",
  "why": ["3-6 short sentences tying picks to the constraints"],
  "pros": ["up to 4"],
  "cons": ["up to 4"],
  "categories": [
    { "cat": "frontend|backend|database|auth|hosting", "name": "Real product or framework",
      "reason": "one short sentence", "note": "optional pricing/quirk note",
      "url": "https://...", "alternatives": ["name", "name"] }
  ],
  "extras": [
    { "cat": "payments|storage|realtime|search|notifications|cicd|monitoring", ...same fields }
  ],
  "roadmap": [{ "title": "short step", "detail": "one or two sentences" }]
}

Rules:
- "categories" must contain exactly one entry for each of the five cats, in order: frontend, backend, database, auth, hosting.
- For an API/backend-service project with no UI, "cat": "frontend" gets name "API consumers only" and an empty url.
- Extras: include only what the must-have features need, plus cicd and monitoring.
- Honor the constraints strictly: a free budget means free tiers; a beginner team means gentle tools; a days timeline means managed services.
- Use real, current products with real URLs. Keep every reason one short sentence.`;

function isStr(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function asStrArr(x: unknown): string[] {
  return Array.isArray(x) ? x.filter(isStr) : [];
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tech';
}

function extractJson(text: string): AiRec {
  let s = text.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('The model did not return JSON.');
  }
  return JSON.parse(s.slice(first, last + 1)) as AiRec;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  buildStackAi(idea: string, c: Constraints, s: AiSettings): Promise<StackRec> {
    if (!isStr(s.apiKey)) {
      return Promise.reject(new Error('Add your API key in AI settings first.'));
    }
    const user = [
      `Project idea: ${idea}`,
      '',
      'Constraints:',
      JSON.stringify({
        type: c.type,
        expectedUsers: c.scale,
        teamSize: c.teamSize,
        experience: c.experience,
        budget: c.budget,
        timeline: c.timeline,
        mustHaveFeatures: c.features,
        preferredTools: c.prefs || null,
      }, null, 2),
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
      body: JSON.stringify({
        model: s.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = '';
          try {
            const t = await res.text();
            detail = t.slice(0, 200);
          } catch {}
          throw new Error(`the model answered ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const data = await res.json();
        const text: unknown = data?.choices?.[0]?.message?.content;
        if (!isStr(text)) throw new Error('the model returned an empty answer');
        return this.toStackRec(extractJson(text), c);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') {
          throw new Error('the model took too long to answer');
        }
        throw e instanceof Error ? e : new Error('the AI request failed');
      })
      .finally(() => clearTimeout(timer));
  }

  /** Validate the model's JSON hard, and map it onto the shape the UI already renders. */
  private toStackRec(r: AiRec, c: Constraints): StackRec {
    const cats = Array.isArray(r.categories) ? r.categories : [];
    const byCat = new Map(cats.filter((x) => isStr(x?.cat) && isStr(x?.name)).map((x) => [x.cat, x]));
    for (const cat of VALID_CATS) {
      if (!byCat.has(cat)) {
        throw new Error('the model returned an incomplete stack');
      }
    }

    const categories: CategoryPick[] = VALID_CATS.map((cat) => {
      const x = byCat.get(cat)!;
      return {
        cat,
        label: CAT_LABELS[cat],
        pick: this.toTech(x, cat, c.type),
        alternatives: asStrArr(x.alternatives).slice(0, 2).map((n) => this.nameToTech(n, cat, c.type)),
        reason: isStr(x.reason) ? x.reason : 'recommended for your constraints',
      };
    });

    const extras: ExtraPick[] = (Array.isArray(r.extras) ? r.extras : [])
      .filter((x) => isStr(x?.cat) && isStr(x?.name) && VALID_EXTRA_CATS.includes(x.cat))
      .map((x) => ({
        cat: x.cat,
        label: this.extraLabel(x.cat),
        pick: this.toTech(x, x.cat, c.type),
        alternatives: asStrArr(x.alternatives).slice(0, 2).map((n) => this.nameToTech(n, x.cat, c.type)),
      }));

    const difficulty = ['Easy', 'Medium', 'Hard'].includes(r.difficulty) ? r.difficulty as StackRec['difficulty'] : 'Medium';
    const costIn = Array.isArray(r.cost) ? r.cost : [];
    const min = Math.max(0, Math.round(Number(costIn[0]) || 0));
    const max = Math.max(min, Math.round(Number(costIn[1]) || 0));

    const roadmap: RoadmapStep[] = (Array.isArray(r.roadmap) ? r.roadmap : [])
      .filter((x) => isStr(x?.title) && isStr(x?.detail))
      .map((x) => ({ title: x.title.trim(), detail: x.detail.trim() }));
    if (!roadmap.length) {
      roadmap.push({ title: 'Map the core flows', detail: 'Write down the 2-3 things users actually do, then sketch the data model.' });
    }

    return {
      categories,
      extras,
      difficulty,
      difficultyNote: isStr(r.difficultyNote) ? r.difficultyNote : 'Expect some learning along the way, but nothing you cannot out-Google.',
      cost: [min, max],
      costNote: isStr(r.costNote) ? r.costNote : (max === 0
        ? 'Everything picked runs on free tiers at modest scale.'
        : 'Upper end assumes you outgrow the free tiers with real traffic.'),
      why: asStrArr(r.why).length ? asStrArr(r.why) : ['Chosen by an LLM from your idea and constraints.'],
      pros: asStrArr(r.pros),
      cons: asStrArr(r.cons),
      roadmap,
    };
  }

  private extraLabel(cat: string): string {
    return EXTRA_CATS.find((e) => e.cat === cat)?.label ?? FEATURE_LIST.find((f) => f.id === (cat as FeatureId))?.label ?? cat;
  }

  private toTech(x: AiCategory, cat: string, type: ProjectType): Tech {
    return {
      id: slug(x.name),
      name: x.name.trim(),
      cat,
      curve: 2,
      scale: 3,
      eco: 3,
      speed: 3,
      cost: [0, 0],
      note: isStr(x.note) ? x.note : undefined,
      types: [type],
      blurb: isStr(x.reason) ? x.reason : '',
      url: isStr(x.url) && /^https:\/\//.test(x.url) ? x.url : '',
    };
  }

  private nameToTech(name: string, cat: string, type: ProjectType): Tech {
    return { id: slug(name), name: name.trim(), cat, curve: 2, scale: 3, eco: 3, speed: 3, cost: [0, 0], types: [type], blurb: '', url: '' };
  }
}
