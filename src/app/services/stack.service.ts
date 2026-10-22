import { Injectable } from '@angular/core';
import {
  CAT_LABELS, EXTRA_CATS, FEATURE_LIST, TECH, Tech,
  ProjectType, FeatureId,
} from '../data/tech';

export interface Constraints {
  type: ProjectType;
  scale: 'small' | 'medium' | 'large';
  teamSize: number;
  experience: 'beginner' | 'intermediate' | 'expert';
  budget: 'free' | 'low' | 'flexible';
  timeline: 'days' | 'weeks' | 'months';
  features: FeatureId[];
  prefs: string;
}

export interface CategoryPick {
  cat: string;
  label: string;
  pick: Tech;
  alternatives: Tech[];
  reason: string;
}

export interface ExtraPick {
  cat: string;
  label: string;
  pick: Tech;
  alternatives: Tech[];
}

export interface RoadmapStep { title: string; detail: string }

export interface StackRec {
  categories: CategoryPick[];
  extras: ExtraPick[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  difficultyNote: string;
  cost: [number, number];
  costNote: string;
  why: string[];
  pros: string[];
  cons: string[];
  roadmap: RoadmapStep[];
}

export const SCALE_LABELS: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
export const EXP_LABELS: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };
export const BUDGET_LABELS: Record<string, string> = { free: 'Free tier only', low: 'Low budget', flexible: 'Flexible' };
export const TIMELINE_LABELS: Record<string, string> = { days: 'Days', weeks: 'Weeks', months: 'Months' };

const EXP: Record<string, number> = { beginner: 1, intermediate: 2, expert: 3 };
const SCALE: Record<string, number> = { small: 1, medium: 2, large: 3 };

export interface Profile {
  key: string;
  label: string;
  blurb: string;
  weights: { eco: number; scale: number; ease: number };
}

export const PROFILES: Profile[] = [
  { key: 'simple', label: 'Fast & simple', blurb: 'Fewest moving parts, fastest to ship', weights: { eco: 0.7, scale: 0.5, ease: 2.2 } },
  { key: 'balanced', label: 'Balanced', blurb: 'Good defaults for most projects', weights: { eco: 1, scale: 1, ease: 1 } },
  { key: 'scale', label: 'Scale-ready', blurb: 'Built to grow past your first users', weights: { eco: 1, scale: 2, ease: 0.5 } },
];

const FEATURE_EXTRA: Partial<Record<FeatureId, string>> = {
  payments: 'payments', files: 'storage', realtime: 'realtime', search: 'search', notifications: 'notifications',
};

@Injectable({ providedIn: 'root' })
export class StackService {
  private vendorOf(t: Tech): string | null {
    if (t.id.startsWith('firebase') || t.id === 'firestore') return 'firebase';
    if (t.id.startsWith('supabase')) return 'supabase';
    return null;
  }

  scoreTech(t: Tech, c: Constraints, w: Profile['weights']): number {
    let s = t.eco * 0.4 * w.eco + t.speed * 0.3 * w.eco;
    const need = SCALE[c.scale];
    if (t.scale >= need) s += 2 * w.scale; else s -= (need - t.scale) * 2.5 * w.scale;
    const exp = EXP[c.experience];
    if (t.curve <= exp + 1) s += 2 * w.ease; else s -= (t.curve - exp - 1) * 2.5 * w.ease;

    if (c.budget === 'free') s += t.cost[1] === 0 ? 3 : -3;
    else if (c.budget === 'low') s += t.cost[1] <= 25 ? 2 : (t.cost[1] <= 60 ? 0 : -1.5);
    else s += 0.5;

    if (c.timeline === 'days') { if (t.curve <= 2) s += 2 * w.ease; if (t.curve >= 4) s -= 2 * w.ease; }
    else if (c.timeline === 'weeks' && t.curve <= 2) s += 1 * w.ease;

    for (const f of c.features) if (t.covers?.includes(f)) s += 2;

    const prefs = (c.prefs || '').toLowerCase().split(/[^a-z0-9.+]+/).filter(Boolean);
    for (const p of prefs) {
      if (t.aliases?.includes(p) || t.name.toLowerCase().includes(p)) s += 6;
    }
    return s;
  }

  private prefMatched(t: Tech, c: Constraints): boolean {
    const prefs = (c.prefs || '').toLowerCase().split(/[^a-z0-9.+]+/).filter(Boolean);
    return prefs.some((p) => t.aliases?.includes(p) || t.name.toLowerCase().includes(p));
  }

  private reasonFor(t: Tech, c: Constraints): string {
    if (this.prefMatched(t, c)) return 'you already know it, so you will move fastest';
    const bits: string[] = [];
    if (c.budget === 'free' && t.cost[1] === 0) bits.push('free at your scale');
    else if (t.cost[1] === 0) bits.push('free tier to start');
    if (c.timeline === 'days' && t.curve <= 2) bits.push('quick to pick up');
    if (SCALE[c.scale] >= 3 && t.scale >= 4) bits.push('headroom to grow');
    if (c.experience === 'beginner' && t.curve <= 2) bits.push('beginner-friendly');
    if (!bits.length) bits.push(t.blurb);
    const s = bits.slice(0, 2).join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private rank(cat: string, c: Constraints, w: Profile['weights'], coherenceVendor?: string | null): { t: Tech; s: number }[] {
    let pool = TECH.filter((t) => t.cat === cat && t.types.includes(c.type));
    if (!pool.length) pool = TECH.filter((t) => t.cat === cat);
    return pool.map((t) => {
      let s = this.scoreTech(t, c, w) + Math.random() * 0.4;
      if (coherenceVendor && this.vendorOf(t) === coherenceVendor) s += 2.5;
      if (t.id === 'none' && c.type === 'api') s += 4;
      return { t, s };
    }).sort((a, b) => b.s - a.s);
  }

  buildStack(c: Constraints, profileKey = 'balanced'): StackRec {
    const profile = PROFILES.find((p) => p.key === profileKey) ?? PROFILES[1];
    const w = profile.weights;

    const categories: CategoryPick[] = [];
    let backendVendor: string | null = null;
    for (const cat of ['frontend', 'backend', 'database', 'auth', 'hosting']) {
      const scored = this.rank(cat, c, w, cat === 'backend' ? null : backendVendor);
      const pick = scored[0].t;
      if (cat === 'backend') backendVendor = this.vendorOf(pick);
      categories.push({
        cat, label: CAT_LABELS[cat], pick,
        alternatives: scored.slice(1, 3).map((x) => x.t),
        reason: this.reasonFor(pick, c),
      });
    }

    const extras: ExtraPick[] = [];
    const dbPick = categories.find((x) => x.cat === 'database')?.pick;
    const dbIsPg = dbPick && (dbPick.id === 'postgres' || this.vendorOf(dbPick) === 'supabase');
    for (const f of c.features) {
      const ec = FEATURE_EXTRA[f];
      if (!ec) continue;
      const scored = this.rank(ec, c, w, ec === 'storage' || ec === 'notifications' ? backendVendor : null)
        .filter((x) => x.t.id !== 'pg-fts' || dbIsPg);
      const label = FEATURE_LIST.find((x) => x.id === f)?.label ?? f;
      extras.push({ cat: ec, label, pick: scored[0].t, alternatives: scored.slice(1, 3).map((x) => x.t) });
    }
    for (const ec of EXTRA_CATS.filter((e) => e.cat === 'cicd' || e.cat === 'monitoring')) {
      const scored = this.rank(ec.cat, c, w);
      extras.push({ cat: ec.cat, label: ec.label, pick: scored[0].t, alternatives: scored.slice(1, 2).map((x) => x.t) });
    }

    // difficulty
    const avgCurve = categories.reduce((a, x) => a + x.pick.curve, 0) / categories.length;
    const gap = avgCurve - EXP[c.experience] + (c.features.length >= 4 ? 0.4 : 0);
    const difficulty: StackRec['difficulty'] = gap <= 0.7 ? 'Easy' : gap <= 1.9 ? 'Medium' : 'Hard';
    const difficultyNote = difficulty === 'Easy'
      ? 'A confident solo dev or small team ships this without hand-holding.'
      : difficulty === 'Medium'
        ? 'Expect some learning along the way, but nothing you cannot out-Google.'
        : 'Budget real learning time before the fun parts, especially on the hardest pick below.';

    // cost
    const all = [...categories.map((x) => x.pick), ...extras.map((x) => x.pick)];
    const min = all.reduce((a, t) => a + t.cost[0], 0);
    const max = all.reduce((a, t) => a + t.cost[1], 0);
    const costNote = max === 0
      ? 'Everything picked runs on free tiers at modest scale.'
      : 'Upper end assumes you outgrow the free tiers with real traffic.';

    // why
    const why: string[] = [];
    const typeLabel = c.type === 'aiml' ? 'AI/ML project' : c.type === 'api' ? 'API / backend service' : c.type + ' project';
    why.push(`You are building a ${typeLabel} for a ${c.scale} audience.`);
    why.push(c.experience === 'beginner'
      ? 'With a newer team, the stack favors well-documented tools with gentle learning curves.'
      : c.experience === 'expert'
        ? 'With an experienced team, the stack favors tools with headroom over hand-holding.'
        : 'For an intermediate team, the stack balances shipping fast now with room to grow.');
    if (c.teamSize <= 1) why.push('Running solo, every pick avoids setup overhead you would maintain alone.');
    else why.push(`A team of ${c.teamSize} favors mainstream tools so everyone can review each other's code.`);
    why.push(c.budget === 'free'
      ? 'Everything runs on free tiers, so you can ship at roughly $0/month.'
      : c.budget === 'low'
        ? 'The stack stays under roughly $50/month until you have real traffic.'
        : 'Costs stay flexible: paid services only where they clearly pay off.');
    why.push(c.timeline === 'days'
      ? 'With days not weeks, managed services replace custom infrastructure wherever possible.'
      : c.timeline === 'weeks'
        ? 'A weeks-long timeline favors tools you can be productive in this week.'
        : 'A longer runway justifies standard, durable choices over shortcuts.');
    if (c.features.length) {
      const covered = categories.filter((x) => x.pick.covers?.some((f) => c.features.includes(f as FeatureId)));
      why.push(`Must-haves (${c.features.map((f) => FEATURE_LIST.find((x) => x.id === f)?.label ?? f).join(', ')}) are covered by ${covered.map((x) => x.pick.name).join(', ') || 'the extras below'}.`);
    }
    if (c.prefs.trim()) why.push('Your preferred tools were weighted heavily wherever they fit.');

    // pros & cons
    const pros: string[] = [];
    const cons: string[] = [];
    const baas = categories.find((x) => ['supabase-be', 'firebase-be'].includes(x.pick.id));
    if (baas) pros.push(`${baas.pick.name} bundles auth, database and storage in one service: fewer moving parts to maintain.`);
    for (const x of categories) {
      if (x.pick.eco >= 5 && pros.length < 3) pros.push(`Huge ecosystem and hiring pool around ${x.pick.name}.`);
      if (x.pick.cost[1] === 0 && c.budget === 'free' && pros.length < 3) pros.push(`${x.pick.name} costs nothing at your scale.`);
    }
    if (categories.some((x) => x.pick.id === 'postgres')) pros.push('Postgres carries a project from prototype to production without a migration.');
    for (const x of categories) {
      if (x.pick.curve - EXP[c.experience] >= 2 && cons.length < 3) cons.push(`${x.pick.name} has a steeper learning curve than a ${c.experience} team might want.`);
      if (c.budget === 'free' && x.pick.cost[1] > 0 && cons.length < 3) cons.push(`${x.pick.name} outgrows its free tier once you have steady traffic.`);
    }
    if (categories.some((x) => x.pick.id === 'firebase-be' || x.pick.id === 'firestore')) cons.push('Firebase ties you to proprietary APIs: leaving later means a rewrite of the data layer.');
    if (categories.some((x) => x.pick.id === 'sqlite') && c.scale !== 'small') cons.push('SQLite bottlenecks under heavy concurrent writes.');
    if (categories.some((x) => x.pick.id === 'jwt')) cons.push('Custom auth means you own every security detail, from password hashing to token rotation.');

    // roadmap
    const unit = c.timeline === 'days' ? 'hours' : 'days';
    const roadmap: RoadmapStep[] = [];
    if (c.experience === 'beginner') roadmap.push({ title: 'Follow one official tutorial end to end', detail: `Work through the getting-started guide for ${categories[0].pick.name} before touching your own idea. It pays for itself.` });
    roadmap.push({ title: 'Map the core flows', detail: `Write down the 2-3 things users actually do, then sketch the data model. One afternoon, maximum two ${unit}.` });
    roadmap.push({ title: `Scaffold ${categories[0].pick.name}`, detail: `Get a blank app deployed to ${categories[4].pick.name} on day one. Deploying early makes every later step less scary.` });
    roadmap.push({ title: `Build one slice end to end on ${categories[1].pick.name} + ${categories[2].pick.name}`, detail: 'One screen, one endpoint, one table. Prove the whole path works before adding breadth.' });
    roadmap.push({ title: `Add accounts with ${categories[3].pick.name}`, detail: 'Protect one real page with real sign-in. Do this before features, not after.' });
    for (const e of extras.filter((x) => !['cicd', 'monitoring'].includes(x.cat))) {
      roadmap.push({ title: `Wire up ${e.label.toLowerCase()} with ${e.pick.name}`, detail: e.pick.note ?? 'Ship it behind a simple button before polishing.' });
    }
    roadmap.push({ title: 'Set up CI/CD and monitoring', detail: `${extras.find((x) => x.cat === 'cicd')?.pick.name} to test and deploy on every push, ${extras.find((x) => x.cat === 'monitoring')?.pick.name} so you hear about errors before users tweet them.` });
    roadmap.push({ title: 'Polish, then show real users', detail: 'Ship the ugly-but-working version to five real people this week. Their feedback outranks any tutorial.' });

    return { categories, extras, difficulty, difficultyNote, cost: [min, max], costNote, why, pros, cons, roadmap };
  }

  buildMarkdown(rec: StackRec, idea: string, c: Constraints): string {
    const L: string[] = [];
    L.push(`# StackPick recommendation`);
    L.push('');
    L.push(`**Idea:** ${idea}`);
    L.push(`**Constraints:** ${c.type} | ${c.scale} scale | team of ${c.teamSize} (${c.experience}) | ${c.budget} budget | ${c.timeline} timeline`);
    if (c.features.length) L.push(`**Must-haves:** ${c.features.join(', ')}`);
    if (c.prefs.trim()) L.push(`**Preferred tools:** ${c.prefs}`);
    L.push('');
    L.push(`**Difficulty:** ${rec.difficulty}. **Estimated cost:** $${rec.cost[0]}-${rec.cost[1]}/month. ${rec.costNote}`);
    L.push('');
    L.push('## The stack');
    for (const x of rec.categories) {
      L.push(`- **${x.label}: ${x.pick.name}** — ${x.reason}${x.pick.note ? ` (${x.pick.note})` : ''}`);
      if (x.alternatives.length) L.push(`  - Alternatives: ${x.alternatives.map((a) => a.name).join(', ')}`);
    }
    for (const x of rec.extras) {
      L.push(`- **${x.label}: ${x.pick.name}**${x.pick.note ? ` (${x.pick.note})` : ''}`);
      if (x.alternatives.length) L.push(`  - Alternatives: ${x.alternatives.map((a) => a.name).join(', ')}`);
    }
    L.push('');
    L.push('## Why this stack');
    rec.why.forEach((w) => L.push(`- ${w}`));
    L.push('');
    L.push('## Pros');
    rec.pros.forEach((p) => L.push(`- ${p}`));
    L.push('');
    L.push('## Cons');
    rec.cons.forEach((p) => L.push(`- ${p}`));
    L.push('');
    L.push('## Roadmap');
    rec.roadmap.forEach((r, i) => L.push(`${i + 1}. **${r.title}** — ${r.detail}`));
    L.push('');
    L.push('---');
    L.push('Generated with StackPick');
    return L.join('\n');
  }
}
