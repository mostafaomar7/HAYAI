import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ClinicalGuideline,
  ClinicalGuidelinesService,
  GuidelinePayload,
  GuidelineSection
} from '../../../../core/services/clinical-guidelines.service';
import {
  OPTION_LISTS,
  OptionListsService,
  OptionRow
} from '../../../../core/services/option-lists.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

/** A section as the form holds it: bullets are one textarea per language. */
interface SectionDraft {
  title_en: string;
  title_ar: string;
  items_en: string;
  items_ar: string;
}

interface Draft {
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  subspecialty_id: string;
  sections: SectionDraft[];
  source: string;
  source_url: string;
  last_reviewed_at: string;
  is_published: boolean;
  sort_order: string;
}

const MAX_SECTIONS = 30;
/** Pasted list markers the backend strips too — removed here so the preview count is honest. */
const BULLET = /^\s*(?:[•●▪◦]|[-*])\s*/;

const emptySection = (): SectionDraft => ({ title_en: '', title_ar: '', items_en: '', items_ar: '' });

/**
 * Create and edit one guideline. Content is entered by whoever takes clinical
 * responsibility for it, so both languages sit side by side and the source and
 * review date are part of the form rather than hidden.
 */
@Component({
  selector: 'app-clinical-guideline-form',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './clinical-guideline-form.html',
  styleUrl: './clinical-guideline-form.css'
})
export class ClinicalGuidelineForm {
  private svc = inject(ClinicalGuidelinesService);
  private lists = inject(OptionListsService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly maxSections = MAX_SECTIONS;

  id = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);

  /** A newly picked file, held until save. */
  pdfFile = signal<File | null>(null);
  /** Set once the admin asks for the stored file to be removed. */
  clearPdf = signal(false);
  /** What the server already holds, so Replace/Remove can be offered. */
  storedPdfName = signal<string | null>(null);
  storedPdfUrl = signal<string | null>(null);
  /** The server states its own cap; 10 MB is only the fallback. */
  pdfMaxKb = signal(10240);
  loadError = signal<string | null>(null);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});
  subspecialties = signal<OptionRow[]>([]);

  draft = signal<Draft>({
    title_en: '', title_ar: '', summary_en: '', summary_ar: '',
    subspecialty_id: '', sections: [emptySection()],
    source: '', source_url: '', last_reviewed_at: '',
    is_published: true, sort_order: ''
  });

  isEdit = computed(() => this.id() !== null);

  constructor() {
    this.lists.all(OPTION_LISTS['doctor-subspecialties']).subscribe({
      next: r => this.subspecialties.set(r.items),
      error: () => this.subspecialties.set([])
    });

    const raw = this.route.snapshot.paramMap.get('id');
    if (raw) {
      this.id.set(Number(raw));
      this.load(Number(raw));
    }
  }

  private load(id: number): void {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: g => {
        this.draft.set(this.toDraft(g));
        this.storedPdfName.set(g.has_pdf ? (g.pdf_name ?? 'PDF') : null);
        this.storedPdfUrl.set(g.pdf_url ?? null);
        if (g.pdf_max_kb) this.pdfMaxKb.set(g.pdf_max_kb);
        this.pdfFile.set(null);
        this.clearPdf.set(false);
        this.loading.set(false);
      },
      error: () => { this.loadError.set('guidelines.load_one_failed'); this.loading.set(false); }
    });
  }

  private toDraft(g: ClinicalGuideline): Draft {
    return {
      title_en: g.title_en ?? '',
      title_ar: g.title_ar ?? '',
      summary_en: g.summary_en ?? '',
      summary_ar: g.summary_ar ?? '',
      subspecialty_id: g.subspecialty_id ? String(g.subspecialty_id) : '',
      sections: g.sections?.length
        ? g.sections.map(s => ({
            title_en: s.title_en ?? '',
            title_ar: s.title_ar ?? '',
            items_en: (s.items_en ?? []).join('\n'),
            items_ar: (s.items_ar ?? []).join('\n')
          }))
        : [emptySection()],
      source: g.source ?? '',
      source_url: g.source_url ?? '',
      last_reviewed_at: (g.last_reviewed_at ?? '').slice(0, 10),
      is_published: g.is_published !== false,
      sort_order: g.sort_order != null ? String(g.sort_order) : ''
    };
  }

  // ------------------------------------------------------------------- pdf

  pdfMaxMb(): number {
    return Math.round(this.pdfMaxKb() / 1024);
  }

  /** What to show in the file row: a new pick wins over the stored file. */
  pdfLabel(): string | null {
    const picked = this.pdfFile();
    if (picked) return picked.name;
    return this.clearPdf() ? null : this.storedPdfName();
  }

  onPdfPicked(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    if (!file) return;
    const errors = { ...this.errors() };
    delete errors['pdf'];

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      errors['pdf'] = 'guidelines.pdf_wrong_type';
    } else if (file.size > this.pdfMaxKb() * 1024) {
      errors['pdf'] = 'guidelines.pdf_too_big';
    }
    this.errors.set(errors);
    if (errors['pdf']) { input.value = ''; return; }

    this.pdfFile.set(file);
    // Picking a file is the opposite of removing one.
    this.clearPdf.set(false);
    input.value = '';
  }

  removePdf(): void {
    this.pdfFile.set(null);
    // Only the stored file needs a server-side removal; an unsent pick does not.
    this.clearPdf.set(!!this.storedPdfName());
  }

  // --------------------------------------------------------------- editing

  set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  setSection(index: number, key: keyof SectionDraft, value: string): void {
    this.draft.update(d => ({
      ...d,
      sections: d.sections.map((s, i) => (i === index ? { ...s, [key]: value } : s))
    }));
  }

  addSection(): void {
    if (this.draft().sections.length >= MAX_SECTIONS) return;
    this.draft.update(d => ({ ...d, sections: [...d.sections, emptySection()] }));
  }

  removeSection(index: number): void {
    this.draft.update(d => ({ ...d, sections: d.sections.filter((_, i) => i !== index) }));
  }

  moveSection(index: number, delta: -1 | 1): void {
    const target = index + delta;
    this.draft.update(d => {
      if (target < 0 || target >= d.sections.length) return d;
      const next = [...d.sections];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, sections: next };
    });
  }

  /** Lines that will actually become bullets — shown under each textarea. */
  bulletCount(text: string): number {
    return this.bullets(text).length;
  }

  private bullets(text: string): string[] {
    return text.split(/\r?\n/).map(l => l.replace(BULLET, '').trim()).filter(Boolean);
  }

  subspecialtyLabel(row: OptionRow): string {
    return row.specialty?.name ? `${row.specialty.name} — ${row.name}` : row.name;
  }

  // ----------------------------------------------------------------- saving

  save(): void {
    const d = this.draft();
    const errors: Record<string, string> = {};
    if (!d.title_en.trim() && !d.title_ar.trim()) errors['title_en'] = 'guidelines.title_required';
    if (d.source_url.trim() && !/^https?:\/\//i.test(d.source_url.trim())) errors['source_url'] = 'guidelines.url_invalid';
    if (d.sort_order.trim() && !/^\d+$/.test(d.sort_order.trim())) errors['sort_order'] = 'guidelines.sort_invalid';
    this.errors.set(errors);
    if (Object.keys(errors).length) return;

    const sections: GuidelineSection[] = d.sections
      .map(s => ({
        title_en: s.title_en.trim() || null,
        title_ar: s.title_ar.trim() || null,
        items_en: this.bullets(s.items_en),
        items_ar: this.bullets(s.items_ar)
      }))
      // A section with neither a title nor a bullet is the blank one the form
      // starts with; the backend drops it anyway, so it is not sent.
      .filter(s => s.title_en || s.title_ar || s.items_en.length || s.items_ar.length);

    const body: GuidelinePayload = {
      title_en: d.title_en.trim() || null,
      title_ar: d.title_ar.trim() || null,
      summary_en: d.summary_en.trim() || null,
      summary_ar: d.summary_ar.trim() || null,
      subspecialty_id: d.subspecialty_id ? Number(d.subspecialty_id) : null,
      // The backend fills the specialty in from the subspecialty; sending both
      // risks a mismatch 422, so the specialty is left to it.
      specialty_id: null,
      sections,
      source: d.source.trim() || null,
      source_url: d.source_url.trim() || null,
      last_reviewed_at: d.last_reviewed_at || null,
      is_published: d.is_published,
      sort_order: d.sort_order.trim() ? Number(d.sort_order) : null
    };

    this.saving.set(true);
    this.formError.set(null);
    const id = this.id();
    // A file (or a removal) has to go as multipart; everything else stays JSON.
    const withFile = this.pdfFile() !== null || this.clearPdf();
    const req = withFile
      ? this.svc.saveWithPdf(id, body, this.pdfFile(), this.clearPdf())
      : id === null ? this.svc.create(body) : this.svc.update(id, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.toast('success', id === null ? 'guidelines.created' : 'guidelines.updated');
        this.router.navigate(['/dashboard/lists/clinical-guidelines']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const bag = err.error?.errors as Record<string, string[] | string> | undefined;
        if (err.status === 422 && bag) {
          // Section errors arrive as `sections.2.items_en.4`; they are pinned to
          // the section so the admin can find the line.
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(bag)) {
            const msg = Array.isArray(v) ? v[0] : String(v);
            const m = /^sections\.(\d+)/.exec(k);
            mapped[m ? `section_${m[1]}` : k] = msg;
          }
          this.errors.set(mapped);
          this.formError.set('guidelines.fix_errors');
        } else {
          this.formError.set(err.error?.message ?? 'guidelines.save_failed');
        }
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/lists/clinical-guidelines']);
  }
}
