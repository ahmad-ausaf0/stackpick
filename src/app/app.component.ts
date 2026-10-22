import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StackService, Constraints, StackRec, SCALE_LABELS, EXP_LABELS, BUDGET_LABELS, TIMELINE_LABELS } from './services/stack.service';
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
}

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

  rec: (StackRec & { idea: string; constraints: Constraints }) | null = null;
  saved: SavedItem[] = [];

  constructor(private stack: StackService) {}

  ngOnInit() {
    this.dark = document.documentElement.classList.contains('dark');
    this.saved = this.load();
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

  submit() {
    this.run(this.c);
  }

  regenerate() {
    this.run(this.c);
  }

  private run(constraints: Constraints) {
    constraints.teamSize = Math.min(20, Math.max(1, Math.round(Number(constraints.teamSize) || 1)));
    this.loading = true;
    this.error = '';
    setTimeout(() => {
      try {
        const built = this.stack.buildStack(constraints);
        this.rec = { ...built, idea: this.idea.trim(), constraints: { ...constraints, features: [...constraints.features] } };
        this.savedNotice = false;
        this.step = 3;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        this.error = 'Something went wrong building your recommendation. Try again.';
      } finally {
        this.loading = false;
      }
    }, 700);
  }

  tweak() { this.step = 2; }

  startOver() {
    this.idea = '';
    this.step = 1;
    this.rec = null;
    this.showCompare = false;
  }

  get alreadySaved(): boolean {
    return !!this.rec && this.saved.some((s) => s.idea === this.rec!.idea && JSON.stringify(s.constraints) === JSON.stringify(this.rec!.constraints));
  }

  saveRec() {
    if (!this.rec || this.alreadySaved) return;
    const item: SavedItem = {
      id: Date.now(), idea: this.rec.idea, constraints: this.rec.constraints,
      at: new Date().toISOString(), difficulty: this.rec.difficulty, cost: this.rec.cost,
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
    const md = this.stack.buildMarkdown(this.rec, this.rec.idea, this.rec.constraints);
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
