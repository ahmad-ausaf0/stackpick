import { Component, EventEmitter, Input, Output } from '@angular/core';
import { StackRec, Constraints } from '../services/stack.service';
import { DiagramComponent } from './diagram.component';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [DiagramComponent],
  template: `
    @if (rec; as r) {
      <!-- summary strip -->
      <div class="card mb-4 flex flex-wrap items-center gap-4">
        <div class="flex-1 min-w-[180px]">
          <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Difficulty</div>
          <div class="mt-1 flex items-center gap-2">
            <span class="rounded-full px-3 py-1 text-sm font-semibold"
                  [style.background]="diffColor" [style.color]="'#fff'">{{ r.difficulty }}</span>
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold"
                  [style.background]="source === 'ai' ? '#8b5cf6' : '#64748b'" [style.color]="'#fff'">{{ source === 'ai' ? 'AI pick' : 'Rule-based' }}</span>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ r.difficultyNote }}</p>
        </div>
        <div class="flex-1 min-w-[180px]">
          <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estimated cost</div>
          <div class="mt-1 text-xl font-bold">{{ costText }}<span class="text-sm font-normal text-slate-500"> /month</span></div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ r.costNote }}</p>
        </div>
      </div>

      <!-- why -->
      <div class="card mb-4">
        <h2 class="mb-2 text-lg font-semibold">Why this stack?</h2>
        <ul class="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          @for (w of r.why; track w) { <li class="flex gap-2"><span class="text-indigo-500">→</span><span>{{ w }}</span></li> }
        </ul>
      </div>

      <!-- category cards -->
      <div class="grid gap-4 sm:grid-cols-2">
        @for (c of r.categories; track c.cat) {
          <div class="card">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ c.label }}</div>
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    [style.background]="colorFor(c.cat)">{{ initials(c.pick.name) }}</span>
              <div class="min-w-0">
                @if (c.pick.url) {
                  <a [href]="c.pick.url" target="_blank" rel="noopener"
                     class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{{ c.pick.name }}</a>
                } @else {
                  <span class="font-semibold">{{ c.pick.name }}</span>
                }
                @if (c.pick.note) { <div class="text-xs text-slate-500 dark:text-slate-400">{{ c.pick.note }}</div> }
              </div>
            </div>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ c.reason }}</p>
            @if (c.alternatives.length) {
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Also good: {{ altText(c.alternatives) }}
              </p>
            }
          </div>
        }
      </div>

      <!-- extras -->
      <h2 class="mb-3 mt-6 text-lg font-semibold">Extra tools</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (e of r.extras; track e.cat) {
          <div class="card">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ e.label }}</div>
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    [style.background]="colorFor(e.cat)">{{ initials(e.pick.name) }}</span>
              @if (e.pick.url) {
                <a [href]="e.pick.url" target="_blank" rel="noopener"
                   class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{{ e.pick.name }}</a>
              } @else {
                <span class="font-semibold">{{ e.pick.name }}</span>
              }
            </div>
            @if (e.pick.note) { <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ e.pick.note }}</p> }
            @if (e.alternatives.length) {
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Alt: {{ altText(e.alternatives) }}</p>
            }
          </div>
        }
      </div>

      <!-- pros & cons -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="card">
          <h3 class="mb-2 font-semibold text-emerald-600 dark:text-emerald-400">Pros</h3>
          <ul class="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            @for (p of r.pros; track p) { <li class="flex gap-2"><span class="text-emerald-500">+</span><span>{{ p }}</span></li> }
          </ul>
        </div>
        <div class="card">
          <h3 class="mb-2 font-semibold text-rose-600 dark:text-rose-400">Cons</h3>
          <ul class="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            @for (p of r.cons; track p) { <li class="flex gap-2"><span class="text-rose-500">−</span><span>{{ p }}</span></li> }
          </ul>
        </div>
      </div>

      <!-- diagram -->
      <div class="card mt-6">
        <h2 class="mb-2 text-lg font-semibold">How the pieces connect</h2>
        <app-diagram [rec]="r" />
      </div>

      <!-- roadmap -->
      <div class="card mt-6">
        <h2 class="mb-3 text-lg font-semibold">Suggested learning order</h2>
        <ol class="space-y-3">
          @for (step of r.roadmap; track step.title; let i = $index) {
            <li class="flex gap-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{{ i + 1 }}</span>
              <div>
                <div class="font-medium">{{ step.title }}</div>
                <p class="text-sm text-slate-600 dark:text-slate-300">{{ step.detail }}</p>
              </div>
            </li>
          }
        </ol>
      </div>

      <!-- actions -->
      <div class="sticky bottom-4 z-10 mt-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
        <button class="btn btn-ghost" (click)="tweak.emit()">Tweak &amp; regenerate</button>
        <button class="btn btn-ghost" (click)="compareToggle.emit()">{{ compareOpen ? 'Hide' : 'Show' }} stack comparison</button>
        <button class="btn btn-primary" (click)="save.emit()" [disabled]="alreadySaved">{{ alreadySaved ? 'Saved ✓' : 'Save' }}</button>
        <button class="btn btn-ghost" (click)="exportMd.emit()">Export Markdown</button>
        <button class="btn btn-ghost" (click)="exportPdf()">Export PDF</button>
      </div>
    }
  `,
})
export class ResultsComponent {
  @Input({ required: true }) rec!: StackRec & { idea: string; constraints: Constraints };
  @Input() alreadySaved = false;
  @Input() compareOpen = false;
  @Input() source: 'rules' | 'ai' = 'rules';
  @Output() tweak = new EventEmitter<void>();
  @Output() exportMd = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() compareToggle = new EventEmitter<void>();

  COLORS: Record<string, string> = {
    frontend: '#6366f1', backend: '#10b981', database: '#f59e0b',
    auth: '#ec4899', hosting: '#0ea5e9',
    payments: '#635bff', storage: '#8b5cf6', realtime: '#ef4444',
    search: '#14b8a6', notifications: '#f97316', cicd: '#334155', monitoring: '#64748b',
  };

  get diffColor() {
    return this.rec.difficulty === 'Easy' ? '#10b981' : this.rec.difficulty === 'Medium' ? '#f59e0b' : '#ef4444';
  }
  get costText() {
    const [min, max] = this.rec.cost;
    return max === 0 ? '$0' : '$' + min + '–$' + max;
  }
  colorFor(cat: string) { return this.COLORS[cat] ?? '#64748b'; }
  initials(name: string) { return name.split(/[\s()+]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
  altText(alts: { name: string; url: string }[]) {
    return alts.map((a) => a.name).join(' · ');
  }
  exportPdf() { window.print(); }
}
