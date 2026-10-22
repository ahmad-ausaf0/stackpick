import { Component, Input } from '@angular/core';
import { StackService, PROFILES, StackRec, Constraints } from '../services/stack.service';

@Component({
  selector: 'app-compare',
  standalone: true,
  template: `
    <div class="card mt-4 overflow-x-auto">
      <h2 class="mb-1 text-lg font-semibold">Compare stacks</h2>
      <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
        The same idea and constraints, scored with three different priorities.
      </p>
      <table class="w-full min-w-[560px] text-sm">
        <thead>
          <tr class="text-left">
            <th class="py-2 pr-3"></th>
            @for (p of profiles; track p.key) {
              <th class="px-3 py-2 align-bottom">
                <div class="font-semibold">{{ p.label }}</div>
                <div class="text-xs font-normal text-slate-500 dark:text-slate-400">{{ p.blurb }}</div>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.label) {
            <tr class="border-t border-slate-100 dark:border-slate-700">
              <td class="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ row.label }}</td>
              @for (cell of row.cells; track $index) {
                <td class="px-3 py-2">{{ cell }}</td>
              }
            </tr>
          }
          <tr class="border-t border-slate-100 dark:border-slate-700">
            <td class="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Difficulty</td>
            @for (r of recs; track $index) {
              <td class="px-3 py-2 font-medium">{{ r.difficulty }}</td>
            }
          </tr>
          <tr class="border-t border-slate-100 dark:border-slate-700">
            <td class="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Est. cost /mo</td>
            @for (r of recs; track $index) {
              <td class="px-3 py-2">{{ cost(r) }}</td>
            }
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class CompareComponent {
  @Input({ required: true }) constraints!: Constraints;
  profiles = PROFILES;
  recs: StackRec[] = [];

  ngOnInit() { this.recompute(); }
  ngOnChanges() { this.recompute(); }

  private recompute() {
    if (!this.constraints) return;
    const svc = new StackService();
    this.recs = PROFILES.map((p) => svc.buildStack(this.constraints, p.key));
  }

  get rows() {
    const cats = ['Frontend', 'Backend', 'Database', 'Authentication', 'Hosting & deployment'];
    return cats.map((label, i) => ({
      label,
      cells: this.recs.map((r) => r.categories[i]?.pick.name ?? '—'),
    }));
  }

  cost(r: StackRec) {
    const [min, max] = r.cost;
    return max === 0 ? '$0' : '$' + min + '–$' + max;
  }
}
