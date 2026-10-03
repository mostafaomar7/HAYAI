import { Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { DialogService } from '../../../../../../core/services/dialog.service';
import { isValidUrl, sanitizeHtml } from './block-rules';

/**
 * Small rich-text editor for `html` block fields: a `contenteditable` with a
 * toolbar limited to what the site's typography supports (bold, italic, links,
 * H2/H3, lists, tables) plus an HTML source view.
 *
 * Everything that leaves the editor goes through `sanitizeHtml`, so a paste
 * from Word or a hand-typed `<h1>` / `<script>` / `<iframe>` never reaches the
 * working copy. `document.execCommand` is deprecated but still the only
 * dependency-free way to edit a selection in every browser the dashboard runs on.
 */
@Component({
  selector: 'app-html-editor',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './html-editor.html',
  styleUrls: ['./block-field.css']
})
export class HtmlEditor {
  private dialog = inject(DialogService);

  value = input<string | null | undefined>('');
  /** Direction of the content language, not of the dashboard. */
  dir = input<'ltr' | 'rtl'>('ltr');
  disabled = input(false);
  invalid = input(false);
  inputId = input('');
  label = input('');

  valueChange = output<string>();

  source = signal(false);
  private editor = viewChild<ElementRef<HTMLDivElement>>('editor');
  /** The HTML the editor DOM currently represents — avoids rewriting it (and losing the caret) on our own echoes. */
  private current: string | null = null;
  private savedRange: Range | null = null;

  constructor() {
    effect(() => {
      const v = this.value() ?? '';
      const el = this.editor()?.nativeElement;
      untracked(() => {
        if (!el || v === this.current) return;
        el.innerHTML = sanitizeHtml(v);
        this.current = v;
      });
    });
  }

  onInput(): void {
    const el = this.editor()?.nativeElement;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    this.current = clean;
    this.valueChange.emit(clean);
  }

  /** Re-render the cleaned HTML once the admin leaves the field (drops stray markup). */
  onBlur(): void {
    const el = this.editor()?.nativeElement;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }

  onPaste(event: ClipboardEvent): void {
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') ?? '';
    event.preventDefault();
    if (html) {
      document.execCommand('insertHTML', false, sanitizeHtml(html));
    } else {
      document.execCommand('insertText', false, text);
    }
    this.onInput();
  }

  onSource(event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value;
    this.valueChange.emit(sanitizeHtml(raw));
  }

  toggleSource(): void {
    this.source.update(s => !s);
  }

  /** Keep the selection when a toolbar button is pressed. */
  keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  exec(command: string, arg?: string): void {
    if (this.disabled()) return;
    this.editor()?.nativeElement.focus();
    document.execCommand(command, false, arg);
    this.onInput();
  }

  block(tag: 'h2' | 'h3' | 'p' | 'blockquote'): void {
    this.exec('formatBlock', `<${tag}>`);
  }

  async link(): Promise<void> {
    if (this.disabled()) return;
    this.saveSelection();
    const url = await this.dialog.prompt({
      title: 'web.blocks.html.link_title',
      text: 'web.blocks.html.link_text',
      placeholder: 'https://…'
    });
    this.restoreSelection();
    if (url === null) return;
    const href = url.trim();
    if (!href) {
      this.exec('unlink');
      return;
    }
    if (!isValidUrl(href)) {
      this.dialog.toast('warning', 'web.blocks.err.url');
      return;
    }
    this.exec('createLink', href);
  }

  insertTable(): void {
    const head = '<thead><tr><th>…</th><th>…</th></tr></thead>';
    const row = '<tr><td>…</td><td>…</td></tr>';
    this.exec('insertHTML', `<table>${head}<tbody>${row}${row}</tbody></table><p><br></p>`);
  }

  private saveSelection(): void {
    const sel = window.getSelection();
    const el = this.editor()?.nativeElement;
    this.savedRange = sel && sel.rangeCount && el?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  }

  private restoreSelection(): void {
    const el = this.editor()?.nativeElement;
    el?.focus();
    if (!this.savedRange) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(this.savedRange);
  }
}
