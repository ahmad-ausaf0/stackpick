import { Component, Input } from '@angular/core';
import { StackRec } from '../services/stack.service';

const COLORS: Record<string, string> = {
  frontend: '#6366f1', backend: '#10b981', database: '#f59e0b',
  auth: '#ec4899', hosting: '#0ea5e9',
  payments: '#635bff', storage: '#8b5cf6', realtime: '#ef4444',
  search: '#14b8a6', notifications: '#f97316', cicd: '#334155', monitoring: '#64748b',
};

@Component({
  selector: 'app-diagram',
  standalone: true,
  template: `
    <svg viewBox="0 0 660 400" class="mx-auto w-full max-w-2xl" role="img" aria-label="Architecture diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="fill-slate-400 dark:fill-slate-500" />
        </marker>
      </defs>

      <text x="110" y="196" text-anchor="middle" class="fill-slate-500 dark:fill-slate-400" font-size="12">
        deployed on {{ hostName }}
      </text>

      <path d="M200 118 H 244" class="stroke-slate-400 dark:stroke-slate-500" stroke-width="2" marker-end="url(#arrow)" />
      <path d="M410 118 H 454" class="stroke-slate-400 dark:stroke-slate-500" stroke-width="2" marker-end="url(#arrow)" />
      <path d="M110 156 V 258 H 244" fill="none" class="stroke-slate-400 dark:stroke-slate-500" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arrow)" />

      @for (b of boxes; track b.cat) {
        <g [attr.transform]="'translate(' + b.x + ',80)'">
          <rect width="180" height="76" rx="14" [attr.fill]="color(b.cat)" fill-opacity="0.12" [attr.stroke]="color(b.cat)" stroke-width="1.5" />
          <circle cx="26" cy="26" r="12" [attr.fill]="color(b.cat)" />
          <text x="26" y="31" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">{{ b.initials }}</text>
          <text x="48" y="30" class="fill-slate-500 dark:fill-slate-400" font-size="11">{{ b.label }}</text>
          <text x="16" y="58" class="fill-slate-900 dark:fill-slate-100" font-size="14" font-weight="600">{{ b.name }}</text>
        </g>
      }

      <g transform="translate(250,220)">
        <rect width="160" height="76" rx="14" [attr.fill]="color('auth')" fill-opacity="0.12" [attr.stroke]="color('auth')" stroke-width="1.5" />
        <circle cx="26" cy="26" r="12" [attr.fill]="color('auth')" />
        <text x="26" y="31" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">A</text>
        <text x="48" y="30" class="fill-slate-500 dark:fill-slate-400" font-size="11">Authentication</text>
        <text x="16" y="58" class="fill-slate-900 dark:fill-slate-100" font-size="14" font-weight="600">{{ authName }}</text>
      </g>

      <text x="330" y="352" text-anchor="middle" class="fill-slate-500 dark:fill-slate-400" font-size="12">
        Extras: {{ extrasText }}
      </text>
    </svg>
  `,
})
export class DiagramComponent {
  @Input({ required: true }) rec!: StackRec;

  get boxes() {
    return ['frontend', 'backend', 'database'].map((cat, i) => {
      const c = this.rec.categories.find((x) => x.cat === cat)!;
      return { cat, x: 20 + i * 230, label: c.label, name: c.pick.name, initials: c.pick.name.slice(0, 2) };
    });
  }

  get authName() { return this.rec.categories.find((c) => c.cat === 'auth')?.pick.name ?? ''; }
  get hostName() { return this.rec.categories.find((c) => c.cat === 'hosting')?.pick.name ?? ''; }
  get extrasText() {
    const names = this.rec.extras.map((e) => e.pick.name);
    return names.slice(0, 5).join(' · ') + (names.length > 5 ? ' · …' : '');
  }
  color(cat: string) { return COLORS[cat] ?? '#64748b'; }
}
