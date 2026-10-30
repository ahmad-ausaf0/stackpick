import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StackService, Constraints, StackRec, SCALE_LABELS, EXP_LABELS, BUDGET_LABELS, TIMELINE_LABELS } from './services/stack.service';
import { AiService, AiSettings, DEFAULT_AI_SETTINGS } from './services/ai.service';
import { TYPE_LIST, FEATURE_LIST, FeatureId, ProjectType } from './data/tech';
import { ResultsComponent } from './components/results.component';
import { CompareComponent } from './components/compare.component';

interface SavedItem {
  id: number;
  idea: string;
  constraints: Constraints;
  at: string;
  difficulty: string;
  cost: [number, number];
  source: 'rules' | 'ai';
}

type RecSource = 'rules' | 'ai';

const IDEA_CHIPS = [
  'A food delivery app for my city',
  'A personal blog with comments',
  'A SaaS dashboard with subscriptions',
  'A realtime chat app',
  'An online store with UPI payments',
  'A portfolio site with a CMS',
  'A multiplayer quiz game',
  'An AI chatbot that answers FAQs',
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, FormsModule, ResultsComponent, CompareComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  step = 1;
  view: 'builder' | 'saved' = 'builder';
  dark = false;
  idea = '';
  loading = false;
  error = '';
  showCompare = false;
  savedNotice = false;

  // AI mode
  aiMode = false;
  lastSource: RecSource = 'rules';
  showAiSettings = false;
  keyVisible = false;
  aiSettings: AiSettings = { ...DEFAULT_AI_SETTINGS };

  ideaChips = IDEA_CHIPS;
  types = TYPE_LIST;
  features = FEATURE_LIST;
  scales = ['small', 'medium', 'large'] as const;
  experiences = ['beginner', 'intermediate', 'expert'] as const;
  budgets = ['free', 'low', 'flexible'] as const;
  timelines = ['days', 'weeks', 'months'] as const;
  scaleLabels = SCALE_LABELS;
  expLabels = EXP_LABELS;
  budgetLabels = BUDGET_LABELS;
  timelineLabels = TIMELINE_LABELS;

  c: Constraints = {
    type: 'web', scale: 'small', teamSize: 1, experience: 'beginner',
    budget: 'free', timeline: 'weeks', features: [], prefs: '',
  };

  rec: (StackRec & { idea: string; constraints: Constraints; source: RecSource }) | null = null;
  saved: SavedItem[] = [];

  constructor(private stack: StackService, private ai: AiService) {}

  ngOnInit() {
    this.dark = document.documentElement.classList.contains('dark');
    this.saved = this.load();
    this.aiMode = localStorage.getItem('stackpick.aiMode') === '1';
    try {
      const stored = JSON.parse(localStorage.getItem('stackpick.ai') || 'null');
      if (stored && typeof stored === 'object') {
        this.aiSettings = { ...DEFAULT_AI_SETTINGS, ...stored };
      }
    } catch {}
  }

  altNames(alts: { name: string }[]): string {
    return alts.map((a) => a.name).join(', ');
  }

  toggleTheme() {
    this.dark = !this.dark;
    document.documentElement.classList.toggle('dark', this.dark);
    try { localStorage.setItem('stackpick.theme', this.dark ? 'dark' : 'light'); } catch {}
  }

  nextFromIdea() {
    if (!this.idea.trim()) { this.error = 'Tell me a sentence about your project first.'; return; }
    this.error = '';
    this.step = 2;
  }

  toggleFeature(f: FeatureId) {
    this.c.features = this.c.features.includes(f)
      ? this.c.features.filter((x) => x !== f)
      : [...this.c.features, f];
  }

  setAiMode(on: boolean) {
    this.aiMode = on;
    try { localStorage.setItem('stackpick.aiMode', on ? '1' : '0'); } catch {}
  }

  saveAiSettings() {
    try { localStorage.setItem('stackpick.ai', JSON.stringify(this.aiSettings)); } catch {}
  }

  get hasApiKey(): boolean {
    return this.aiSettings.apiKey.trim().length > 0;
  }

  submit() {
    this.run(this.c);
  }

  regenerate() {
    this.run(this.c);
  }

  private run(constraints: Constraints) {
    constraints.teamSize = Math.min(20, Math.max(1, Math.round(Number(constraints.teamSize) || 1)));
    const source: RecSource = this.aiMode ? 'ai' : 'rules';
    this.lastSource = source;
    this.loading = true;
    this.error = '';
    const idea = this.idea.trim();

    const done = (built: StackRec, usedSource: RecSource, notice?: string) => {
      this.rec = {
        ...built, idea,
        constraints: { ...constraints, features: [...constraints.features] },
        source: usedSource,
      };
      if (notice) this.error = notice;
      this.savedNotice = false;
      this.step = 3;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.loading = false;
    };

    if (source === 'rules') {
      setTimeout(() => {
        try {
          done(this.stack.buildStack(constraints), 'rules');
        } catch {
          this.loading = false;
          this.error = 'Something went wrong building your recommendation. Try again.';
        }
      }, 700);
      return;
    }

    if (!this.hasApiKey) {
      this.loading = false;
      this.error = 'Add your API key in AI settings first, or switch back to the rule-based engine.';
      this.showAiSettings = true;
      return;
    }

    this.ai.buildStackAi(idea, constraints, this.aiSettings)
      .then((built) => done(built, 'ai'))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'the AI request failed';
        try {
          done(this.stack.buildStack(constraints), 'rules', `AI pick failed (${msg}). Showing the rule-based stack instead.`);
        } catch {
          this.loading = false;
          this.error = `AI pick failed (${msg}).`;
        }
      });
  }

  tweak() { this.step = 2; }

  startOver() {
    this.idea = '';
    this.step = 1;
    this.rec = null;
    this.showCompare = false;
    this.showAiSettings = false;
  }

  get alreadySaved(): boolean {
    return !!this.rec && this.saved.some((s) => s.idea === this.rec!.idea && JSON.stringify(s.constraints) === JSON.stringify(this.rec!.constraints));
  }

  saveRec() {
    if (!this.rec || this.alreadySaved) return;
    const item: SavedItem = {
      id: Date.now(), idea: this.rec.idea, constraints: this.rec.constraints,
      at: new Date().toISOString(), difficulty: this.rec.difficulty, cost: this.rec.cost,
      source: this.rec.source,
    };
    this.saved = [item, ...this.saved];
    this.persist();
    this.savedNotice = true;
  }

  openSaved(item: SavedItem) {
    this.idea = item.idea;
    this.c = { ...item.constraints, features: [...item.constraints.features] };
    this.view = 'builder';
    this.run(this.c);
  }

  deleteSaved(item: SavedItem) {
    this.saved = this.saved.filter((s) => s.id !== item.id);
    this.persist();
  }

  exportMarkdown() {
    if (!this.rec) return;
    const md = this.stack.buildMarkdown(this.rec, this.rec.idea, this.rec.constraints)
      .replace('# StackPick recommendation', `# StackPick recommendation (${this.rec.source === 'ai' ? 'AI pick' : 'rule-based'})`);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stackpick-' + this.rec.idea.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private load(): SavedItem[] {
    try { return JSON.parse(localStorage.getItem('stackpick.saved') || '[]'); } catch { return []; }
  }
  private persist() {
    try { localStorage.setItem('stackpick.saved', JSON.stringify(this.saved)); } catch {}
  }
}
