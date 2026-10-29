import { TelegramWebApp } from './lib/telegram';

type FeedbackEntryPoint = 'home' | 'player' | 'chat-nav';

interface FeedbackContext {
  entryPoint: FeedbackEntryPoint;
  lessonId?: string;
  lessonTitle?: string;
}

interface SelectedAttachment {
  file: File;
  url: string;
}

const MAX_ATTACHMENTS = 5;
const MAX_QUESTION_LENGTH = 1000;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const ERROR_MESSAGES: Record<string, string> = {
  invalid_question: 'Напишите вопрос длиной до 1000 символов.',
  unsupported_attachment_type: 'Можно прикрепить только поддерживаемые фото и видео.',
  attachment_signature_mismatch: 'Формат одного из файлов не совпадает с его содержимым.',
  attachment_too_large: 'Один из файлов превышает допустимый размер.',
  feedback_too_large: 'Общий размер вложений не должен превышать 50 МБ.',
  too_many_attachments: 'Можно прикрепить не больше пяти файлов.',
  rate_limited: 'Вы уже отправили несколько вопросов. Попробуйте снова через 10 минут.',
  not_authenticated: 'Сессия истекла. Перезапустите приложение и повторите отправку.',
  telegram_delivery_failed: 'Не удалось доставить вопрос. Проверьте соединение и попробуйте ещё раз.',
  subscription_required: 'Чат с кинологом доступен по платной подписке. Обратитесь к менеджеру школы.',
};

export function setupFeedbackFlow(root: HTMLElement, webApp: TelegramWebApp | null): () => void {
  let overlay: HTMLElement | null = null;
  let opener: HTMLElement | null = null;
  let context: FeedbackContext | null = null;
  let attachments: SelectedAttachment[] = [];
  let submitting = false;
  let historyArmed = false;
  let suppressNextPopState = false;
  let discardDialogOpen = false;
  let discardFromHistory = false;
  let detachViewportSync: (() => void) | null = null;

  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) return;
    const trigger = target.closest<HTMLElement>('[data-feedback-open]');

    if (!trigger || !root.contains(trigger)) return;
    event.preventDefault();
    openFeedback(trigger);
  };

  const onPopState = (event: PopStateEvent): void => {
    if (suppressNextPopState) {
      suppressNextPopState = false;
      event.stopImmediatePropagation();
      return;
    }

    if (!overlay || !historyArmed) return;
    event.stopImmediatePropagation();
    historyArmed = false;

    if (submitting) {
      armHistory();
      return;
    }

    if (isDirty()) {
      showDiscardDialog(true);
      return;
    }

    finishClose(false);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!overlay) return;

    if (event.key === 'Escape') {
      event.preventDefault();

      if (discardDialogOpen) {
        hideDiscardDialog();
      } else {
        requestClose();
      }
      return;
    }

    if (event.key !== 'Tab') return;
    const scope = discardDialogOpen
      ? overlay.querySelector<HTMLElement>('[data-feedback-discard-dialog]')
      : overlay.querySelector<HTMLElement>('.feedback-sheet');
    const focusable = getFocusableElements(scope);

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const openFeedback = (trigger: HTMLElement): void => {
    if (overlay) return;
    const entryPoint = trigger.dataset.feedbackEntry as FeedbackEntryPoint | undefined;

    if (!entryPoint || !['home', 'player', 'chat-nav'].includes(entryPoint)) return;
    context = {
      entryPoint,
      lessonId: trigger.dataset.feedbackLessonId,
      lessonTitle: trigger.dataset.feedbackLessonTitle,
    };
    opener = trigger;
    const hasSubscription = document.documentElement.dataset.hasSubscription === 'true';

    overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    overlay.innerHTML = hasSubscription ? createFormMarkup() : createPaywallMarkup();
    document.body.append(overlay);
    document.documentElement.classList.add('feedback-open');
    detachViewportSync = attachViewportSync(overlay);
    if (hasSubscription) {
      bindFormEvents();
    } else {
      bindPaywallEvents();
    }
    armHistory();
    window.requestAnimationFrame(() => {
      overlay?.classList.add('feedback-overlay--visible');
      overlay?.querySelector<HTMLHeadingElement>('#feedback-title')?.focus();
    });
    webApp?.HapticFeedback?.impactOccurred('light');
  };

  const bindFormEvents = (): void => {
    const form = overlay?.querySelector<HTMLFormElement>('[data-feedback-form]');
    const textarea = overlay?.querySelector<HTMLTextAreaElement>('[data-feedback-question]');
    const input = overlay?.querySelector<HTMLInputElement>('[data-feedback-files]');

    overlay?.querySelector<HTMLElement>('[data-feedback-close]')?.addEventListener('click', requestClose);
    textarea?.addEventListener('input', () => {
      updateCounter();
      showError('');
    });
    input?.addEventListener('change', () => {
      addFiles(Array.from(input.files ?? []));
      input.value = '';
    });
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitFeedback();
    });
  };

  const bindPaywallEvents = (): void => {
    overlay?.querySelectorAll<HTMLElement>('[data-feedback-close]').forEach((element) => {
      element.addEventListener('click', requestClose);
    });
  };

  const addFiles = (files: File[]): void => {
    showError('');

    for (const file of files) {
      if (attachments.length >= MAX_ATTACHMENTS) {
        showError('Можно прикрепить не больше пяти файлов.');
        break;
      }

      if (!ACCEPTED_TYPES.has(file.type)) {
        showError(`Файл «${file.name}» имеет неподдерживаемый формат.`);
        continue;
      }

      const maximumSize = file.type.startsWith('image/') ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;

      if (file.size > maximumSize) {
        showError(`Файл «${file.name}» слишком большой.`);
        continue;
      }

      if (attachments.reduce((total, item) => total + item.file.size, 0) + file.size > MAX_TOTAL_BYTES) {
        showError('Общий размер вложений не должен превышать 50 МБ.');
        continue;
      }

      attachments.push({ file, url: URL.createObjectURL(file) });
    }

    renderAttachments();
  };

  const renderAttachments = (): void => {
    const list = overlay?.querySelector<HTMLElement>('[data-feedback-previews]');

    if (!list) return;
    list.innerHTML = attachments.map((attachment, index) => {
      const escapedName = escapeAttribute(attachment.file.name);
      const media = attachment.file.type.startsWith('image/')
        ? `<img src="${escapeAttribute(attachment.url)}" alt="Превью файла ${escapedName}" data-feedback-preview-media />`
        : `<video src="${escapeAttribute(attachment.url)}" muted playsinline preload="metadata" aria-label="Превью файла ${escapedName}" data-feedback-preview-media></video>`;
      return `
        <div class="feedback-preview">
          ${media}
          <span class="feedback-preview__fallback" data-feedback-preview-fallback hidden>
            <span aria-hidden="true">${attachment.file.type.startsWith('image/') ? 'Фото' : 'Видео'}</span>
            <small>${escapedName}</small>
          </span>
          <span class="feedback-preview__type">${attachment.file.type.startsWith('image/') ? 'Фото' : 'Видео'}</span>
          <button class="feedback-preview__remove" type="button" data-feedback-remove="${index}" aria-label="Удалить ${escapedName}">×</button>
        </div>
      `;
    }).join('');
    list.hidden = attachments.length === 0;
    list.querySelectorAll<HTMLImageElement | HTMLVideoElement>('[data-feedback-preview-media]').forEach((media) => {
      media.addEventListener('error', () => {
        media.hidden = true;
        media.parentElement?.querySelector<HTMLElement>('[data-feedback-preview-fallback]')?.removeAttribute('hidden');
      });
    });
    list.querySelectorAll<HTMLButtonElement>('[data-feedback-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.feedbackRemove);
        const removed = attachments.splice(index, 1)[0];
        if (removed) URL.revokeObjectURL(removed.url);
        renderAttachments();
      });
    });
  };

  const submitFeedback = async (): Promise<void> => {
    if (!overlay || !context || submitting) return;
    const textarea = overlay.querySelector<HTMLTextAreaElement>('[data-feedback-question]');
    const question = textarea?.value.trim() ?? '';

    if (!question) {
      showError('Напишите вопрос перед отправкой.');
      textarea?.focus();
      return;
    }

    submitting = true;
    setSubmittingState(true, 0);
    const formData = new FormData();
    formData.append('question', question);
    formData.append('entryPoint', context.entryPoint);
    if (context.lessonId) formData.append('lessonId', context.lessonId);
    if (context.lessonTitle) formData.append('lessonTitle', context.lessonTitle);
    attachments.forEach(({ file }) => formData.append('attachments', file, file.name));

    try {
      await uploadFeedback(formData, (progress) => setSubmittingState(true, progress));
      showSuccess();
      webApp?.HapticFeedback?.impactOccurred('medium');
    } catch (error) {
      const code = error instanceof FeedbackUploadError ? error.code : '';
      showError(ERROR_MESSAGES[code] ?? 'Не удалось отправить вопрос. Попробуйте ещё раз.');
      setSubmittingState(false, 0);
    } finally {
      submitting = false;
    }
  };

  const showSuccess = (): void => {
    if (!overlay) return;
    releaseAttachments();
    const sheet = overlay.querySelector<HTMLElement>('.feedback-sheet');
    if (!sheet) return;
    sheet.classList.add('feedback-sheet--success');
    sheet.innerHTML = createSuccessMarkup();
    resetFeedbackScroll(sheet);
    overlay.querySelectorAll<HTMLElement>('[data-feedback-success-close]')
      .forEach((button) => button.addEventListener('click', () => finishClose(true)));
    overlay.querySelector<HTMLElement>('[data-feedback-again]')?.addEventListener('click', () => {
      const activeSheet = overlay?.querySelector<HTMLElement>('.feedback-sheet');
      if (!activeSheet) return;
      activeSheet.classList.remove('feedback-sheet--success');
      activeSheet.innerHTML = createFormContentMarkup();
      resetFeedbackScroll(activeSheet);
      bindFormEvents();
      overlay?.querySelector<HTMLHeadingElement>('#feedback-title')?.focus();
    });
    overlay.querySelector<HTMLHeadingElement>('#feedback-title')?.focus();
  };

  const requestClose = (): void => {
    if (!overlay || submitting) return;
    if (isDirty()) {
      showDiscardDialog(false);
      return;
    }
    finishClose(true);
  };

  const showDiscardDialog = (fromHistory: boolean): void => {
    if (!overlay || discardDialogOpen) return;
    discardDialogOpen = true;
    discardFromHistory = fromHistory;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const dialog = document.createElement('div');
    dialog.className = 'feedback-confirm';
    dialog.dataset.feedbackDiscardDialog = '';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'feedback-discard-title');
    dialog.innerHTML = `
      <div class="feedback-confirm__card">
        <h2 id="feedback-discard-title">Удалить черновик?</h2>
        <p>Текст вопроса и выбранные файлы не сохранятся.</p>
        <div class="feedback-confirm__actions">
          <button type="button" data-feedback-keep>Продолжить заполнение</button>
          <button class="feedback-confirm__discard" type="button" data-feedback-discard>Удалить</button>
        </div>
      </div>
    `;
    overlay.append(dialog);
    dialog.querySelector<HTMLElement>('[data-feedback-keep]')?.addEventListener('click', () => {
      hideDiscardDialog();
    });
    dialog.querySelector<HTMLElement>('[data-feedback-discard]')?.addEventListener('click', () => {
      discardDialogOpen = false;
      discardFromHistory = false;
      finishClose(!fromHistory);
    });
    dialog.querySelector<HTMLButtonElement>('[data-feedback-keep]')?.focus();
  };

  const hideDiscardDialog = (): void => {
    overlay?.querySelector('[data-feedback-discard-dialog]')?.remove();
    discardDialogOpen = false;
    const shouldRearmHistory = discardFromHistory;
    discardFromHistory = false;
    if (shouldRearmHistory) armHistory();
    overlay?.querySelector<HTMLTextAreaElement>('[data-feedback-question]')?.focus();
  };

  const finishClose = (rewindHistory: boolean): void => {
    if (!overlay) return;
    const closingOverlay = overlay;
    overlay = null;
    context = null;
    discardDialogOpen = false;
    discardFromHistory = false;
    detachViewportSync?.();
    detachViewportSync = null;
    releaseAttachments();
    document.documentElement.classList.remove('feedback-open');
    closingOverlay.classList.remove('feedback-overlay--visible');
    window.setTimeout(() => closingOverlay.remove(), 220);

    if (rewindHistory && historyArmed) {
      historyArmed = false;
      suppressNextPopState = true;
      window.history.back();
    } else {
      historyArmed = false;
    }

    opener?.focus();
    opener = null;
  };

  const armHistory = (): void => {
    if (historyArmed) return;
    window.history.pushState({ ...window.history.state, feedbackModal: true }, '', window.location.href);
    historyArmed = true;
  };

  const isDirty = (): boolean => {
    const question = overlay?.querySelector<HTMLTextAreaElement>('[data-feedback-question]')?.value.trim();
    return Boolean(question || attachments.length > 0);
  };

  const updateCounter = (): void => {
    const textarea = overlay?.querySelector<HTMLTextAreaElement>('[data-feedback-question]');
    const counter = overlay?.querySelector<HTMLElement>('[data-feedback-counter]');
    if (textarea && counter) counter.textContent = `${textarea.value.length}/${MAX_QUESTION_LENGTH}`;
  };

  const setSubmittingState = (active: boolean, progress: number): void => {
    overlay?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button')
      .forEach((control) => { control.disabled = active; });
    const button = overlay?.querySelector<HTMLButtonElement>('[data-feedback-submit]');
    const label = overlay?.querySelector<HTMLElement>('[data-feedback-submit-label]');
    const bar = overlay?.querySelector<HTMLElement>('[data-feedback-progress-bar]');
    if (button) button.classList.toggle('feedback-submit--loading', active);
    if (label) label.textContent = active ? `Отправляем… ${progress}%` : 'Отправить вопрос';
    if (bar) {
      bar.style.setProperty('--feedback-upload-progress', `${progress}%`);
      bar.setAttribute('aria-valuenow', String(progress));
    }
  };

  const showError = (message: string): void => {
    const error = overlay?.querySelector<HTMLElement>('[data-feedback-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  };

  const releaseAttachments = (): void => {
    attachments.forEach(({ url }) => URL.revokeObjectURL(url));
    attachments = [];
  };

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('popstate', onPopState);

  return () => {
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('popstate', onPopState);
    if (overlay) finishClose(false);
  };
}

class FeedbackUploadError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FeedbackUploadError';
  }
}

function uploadFeedback(formData: FormData, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/feedback');
    request.withCredentials = true;
    request.responseType = 'json';
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300 && request.response?.ok) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new FeedbackUploadError(String(request.response?.error || 'request_failed')));
    });
    request.addEventListener('error', () => reject(new FeedbackUploadError('network_error')));
    request.addEventListener('timeout', () => reject(new FeedbackUploadError('network_error')));
    request.timeout = 10 * 60 * 1000;
    request.send(formData);
  });
}

function createFormMarkup(): string {
  return `
    <section class="feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      ${createFormContentMarkup()}
    </section>
  `;
}

function createPaywallMarkup(): string {
  return `
    <section class="feedback-sheet feedback-sheet--paywall" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div class="feedback-sheet__chrome">
        <div class="feedback-sheet__handle" aria-hidden="true"></div>
        <button class="feedback-sheet__close" type="button" data-feedback-close aria-label="Закрыть">×</button>
      </div>
      <div class="feedback-sheet__scroll" data-feedback-scroll>
        <div class="feedback-sheet__visual" aria-hidden="true">
          <img class="feedback-sheet__hero" src="/assets/feedback/feedback-main.svg" alt="" />
        </div>
        <div class="feedback-sheet__body feedback-paywall">
          <h2 id="feedback-title" tabindex="-1">Чат с кинологом 🔒</h2>
          <p class="feedback-sheet__intro">Консультации кинолога и персональные разборы видео доступны только на платном тарифе.</p>
          
          <div class="feedback-paywall__card">
            <div class="feedback-paywall__item">
              <span class="feedback-paywall__icon" aria-hidden="true">💬</span>
              <span><strong>Ответы на вопросы</strong> по воспитанию и поведению вашего щенка</span>
            </div>
            <div class="feedback-paywall__item">
              <span class="feedback-paywall__icon" aria-hidden="true">📹</span>
              <span><strong>Разбор видео тренировок</strong> от профессионального кинолога</span>
            </div>
            <div class="feedback-paywall__item">
              <span class="feedback-paywall__icon" aria-hidden="true">⭐</span>
              <span><strong>Персональные советы</strong> и поддержка на всех этапах обучения</span>
            </div>
          </div>

          <div class="feedback-paywall__hint">
            Для оформления или продления подписки обратитесь к вашему менеджеру школы в Telegram.
          </div>

          <button class="feedback-submit" type="button" data-feedback-close>
            <span>Понятно</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

function createFormContentMarkup(): string {
  return `
      <div class="feedback-sheet__chrome">
        <div class="feedback-sheet__handle" aria-hidden="true"></div>
        <button class="feedback-sheet__close" type="button" data-feedback-close aria-label="Закрыть форму">×</button>
      </div>
      <div class="feedback-sheet__scroll" data-feedback-scroll>
        <div class="feedback-sheet__visual" aria-hidden="true">
          <img class="feedback-sheet__hero" src="/assets/feedback/feedback-main.svg" alt="" />
        </div>
        <div class="feedback-sheet__body">
          <h2 id="feedback-title" tabindex="-1">Задайте вопрос кинологу</h2>
          <p class="feedback-sheet__intro">Опишите ситуацию — кинолог поможет разобраться и подскажет, как действовать.</p>
          <form class="feedback-form" data-feedback-form novalidate>
            <label class="feedback-field">
              <span class="feedback-field__label">Ваш вопрос</span>
              <span class="feedback-field__control">
                <textarea data-feedback-question maxlength="1000" rows="5" placeholder="Расскажите подробнее, что происходит и с чем нужна помощь…" required></textarea>
                <span class="feedback-field__counter" data-feedback-counter>0/1000</span>
              </span>
            </label>
            <label class="feedback-attach">
              <span class="feedback-attach__icon" aria-hidden="true"></span>
              <span><strong>Прикрепить файлы</strong><small>Фото или видео</small></span>
              <span class="feedback-arrow-icon feedback-attach__arrow" aria-hidden="true"></span>
              <input data-feedback-files type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" multiple />
            </label>
            <div class="feedback-previews" data-feedback-previews hidden></div>
            <p class="feedback-form__hint">Можно прикрепить до 5 файлов. Фото — до 10 МБ, видео — до 50 МБ. Общий размер — до 50 МБ.</p>
            <p class="feedback-form__error" data-feedback-error role="alert" aria-live="assertive" hidden></p>
            <button class="feedback-submit" type="submit" data-feedback-submit>
              <span data-feedback-submit-label aria-live="polite">Отправить вопрос</span><span class="feedback-arrow-icon" aria-hidden="true"></span>
              <span class="feedback-submit__progress" data-feedback-progress-bar role="progressbar" aria-label="Загрузка вложений" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span>
            </button>
          </form>
        </div>
      </div>
  `;
}

function createSuccessMarkup(): string {
  return `
    <div class="feedback-sheet__chrome">
      <div class="feedback-sheet__handle" aria-hidden="true"></div>
      <button class="feedback-sheet__close" type="button" data-feedback-success-close aria-label="Закрыть">×</button>
    </div>
    <div class="feedback-sheet__scroll" data-feedback-scroll>
      <div class="feedback-sheet__visual" aria-hidden="true">
        <img class="feedback-sheet__hero feedback-sheet__hero--success" src="/assets/feedback/feedback-sent.svg" alt="" />
      </div>
      <div class="feedback-sheet__body feedback-success">
        <h2 id="feedback-title" tabindex="-1">Вопрос отправлен!</h2>
        <p>Кинолог получит ваше сообщение и напишет вам в Telegram.</p>
        <div class="feedback-success__notice">
          <span class="feedback-success__clock" aria-hidden="true"></span>
          <span><strong>Обычно ответ приходит<br />в течение нескольких часов</strong><small>Следите за сообщениями в Telegram.</small></span>
        </div>
        <button class="feedback-submit" type="button" data-feedback-success-close>Закрыть <span class="feedback-arrow-icon" aria-hidden="true"></span></button>
        <button class="feedback-success__again" type="button" data-feedback-again><span aria-hidden="true">＋</span> Задать ещё один вопрос</button>
      </div>
    </div>
  `;
}

function resetFeedbackScroll(sheet: HTMLElement): void {
  const scroll = sheet.querySelector<HTMLElement>('[data-feedback-scroll]');
  if (scroll) scroll.scrollTop = 0;
}

function attachViewportSync(target: HTMLElement): () => void {
  const viewport = window.visualViewport;
  let frame: number | null = null;

  const update = (): void => {
    frame = null;
    const height = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    target.style.setProperty('--feedback-viewport-height', `${Math.round(height)}px`);
    target.style.setProperty('--feedback-viewport-top', `${Math.round(offsetTop)}px`);
  };

  const scheduleUpdate = (): void => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('scroll', scheduleUpdate);

  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('scroll', scheduleUpdate);
  };
}

function getFocusableElements(scope: HTMLElement | null): HTMLElement[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hidden && element.offsetParent !== null);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
