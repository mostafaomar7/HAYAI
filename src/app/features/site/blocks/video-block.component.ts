import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';

/**
 * Video block (website-public-blocks.md §6 `video`). YouTube / Vimeo use the
 * API's `embed_url` (youtube-nocookie / player.vimeo) behind a "lite" facade:
 * a poster and a play button, the third-party iframe (≈1 MB of player JS) is
 * only created on click — embedding it up front would wreck mobile LCP.
 * `provider: self` uses a native `<video preload="none">` from `video.url`.
 * The description and transcript are real text in the HTML (the transcript
 * collapsed in `<details>`), which is what answer engines can index.
 */
@Component({
  selector: 'site-video-block',
  imports: [SiteImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = data();
    <h2 class="blk-title">{{ d['title'] }}</h2>
    @if (d['description']) {
      <p class="blk-intro">{{ d['description'] }}</p>
    }
    <div class="video-frame">
      @if (embed(); as e) {
        @if (playing()) {
          <iframe
            [src]="e.src"
            [title]="d['title']"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy"
          ></iframe>
        } @else {
          <button type="button" class="video-facade" (click)="playing.set(true)" [attr.aria-label]="state.t('playVideo', d['title'])">
            @if (d['poster']) {
              <site-img [image]="d['poster']" sizes="(min-width: 960px) 900px, 100vw" cls="video-poster" />
            } @else if (e.thumb) {
              <img [attr.src]="e.thumb" alt="" width="480" height="360" loading="lazy" decoding="async" class="video-poster" />
            }
            <span class="play-icon" aria-hidden="true"></span>
          </button>
        }
      } @else if (d['video']) {
        <video controls preload="none" playsinline [attr.poster]="d['poster']?.url ?? null" [attr.aria-label]="d['title']">
          <source [attr.src]="d['video'].url" [attr.type]="d['video'].mime_type" />
        </video>
      }
    </div>
    @if (d['transcript']) {
      <details class="transcript">
        <summary>{{ state.t('transcript') }}</summary>
        <p>{{ d['transcript'] }}</p>
      </details>
    }
  `
})
export class VideoBlockComponent {
  readonly data = input.required<Dict>();
  protected state = inject(SiteStateService);
  private sanitizer = inject(DomSanitizer);
  protected playing = signal(false);

  /** youtube / vimeo: the API's `embed_url` (never the watch `url`), with autoplay
   *  added since the click on the facade is the "play". */
  protected embed = computed<{ src: SafeResourceUrl; thumb: string | null } | null>(() => {
    const d = this.data();
    const url: string | null = d['embed_url'];
    if (d['provider'] === 'self' || !url) return null;
    const src = url + (url.includes('?') ? '&' : '?') + (d['provider'] === 'youtube' ? 'autoplay=1&rel=0' : 'autoplay=1&dnt=1');
    const yt = d['provider'] === 'youtube' ? /\/embed\/([\w-]+)/.exec(url)?.[1] : null;
    return {
      src: this.sanitizer.bypassSecurityTrustResourceUrl(src),
      thumb: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null
    };
  });
}
