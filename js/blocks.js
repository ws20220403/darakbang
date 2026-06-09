/**
 * blocks.js — 커스텀 Editor.js 블록 도구
 *
 *   ToggleTool            토글(접기/펼치기)
 *   CalloutTool           콜아웃(강조 박스, 7색)
 *   DarakImageTool        이미지 (Storage 기반: Drive 또는 데모)
 *   PageLinkTool          하위 문서 링크
 *   BookmarkTool          웹 북마크 카드            [신규]
 *   TableOfContentsTool   목차(TOC, 헤더 자동수집)  [신규]
 *
 * 클래식 스크립트의 최상위 class 선언은 전역 렉시컬 스코프에 등록되어
 * editor.js(IIFE)에서 그대로 참조할 수 있다.
 */

/* =========================================================
   TOGGLE
========================================================= */
class ToggleTool {
  static get toolbox() {
    return {
      title: '토글',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.data = data || { title: '', content: '' };
    this.readOnly = readOnly;
    this._isOpen = data?.isOpen ?? true;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = `toggle-block${this._isOpen ? ' is-open' : ''}`;

    const summary = document.createElement('div');
    summary.className = 'toggle-block__summary';

    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = 'toggle-block__arrow';
    arrow.setAttribute('aria-label', '토글 열고 닫기');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';

    const title = document.createElement('div');
    title.className = 'toggle-block__title';
    title.contentEditable = this.readOnly ? 'false' : 'true';
    title.innerHTML = this.data.title || '';
    if (!this.data.title) title.setAttribute('data-placeholder', '토글 제목...');
    title.addEventListener('input', () => Workspace.markDirty());

    const content = document.createElement('div');
    content.className = 'toggle-block__content';
    const inner = document.createElement('div');
    inner.className = 'toggle-block__inner';
    inner.contentEditable = this.readOnly ? 'false' : 'true';
    inner.innerHTML = this.data.content || '';
    if (!this.data.content) inner.setAttribute('data-placeholder', '내용을 입력하세요...');
    inner.addEventListener('input', () => Workspace.markDirty());
    content.appendChild(inner);

    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!this._isOpen) { this._isOpen = true; wrapper.classList.add('is-open'); }
        inner.focus();
      }
    });

    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      this._isOpen = !this._isOpen;
      wrapper.classList.toggle('is-open', this._isOpen);
    });

    summary.appendChild(arrow);
    summary.appendChild(title);
    wrapper.appendChild(summary);
    wrapper.appendChild(content);
    return wrapper;
  }

  save(blockContent) {
    return {
      title:   blockContent.querySelector('.toggle-block__title')?.innerHTML || '',
      content: blockContent.querySelector('.toggle-block__inner')?.innerHTML || '',
      isOpen:  this._isOpen,
    };
  }

  static get sanitize() {
    const inline = { b: true, strong: true, i: true, em: true, u: true, a: { href: true, target: true, rel: true }, code: true, mark: true, br: true };
    return { title: inline, content: inline };
  }
}

/* =========================================================
   CALLOUT
========================================================= */
class CalloutTool {
  static get toolbox() {
    return {
      title: '콜아웃',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };
  }

  static get COLORS() { return ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple']; }

  constructor({ data, readOnly }) {
    this.data = { text: data?.text || '', icon: data?.icon || '💡', color: data?.color || 'blue' };
    this.readOnly = readOnly;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'callout-block';
    wrapper.setAttribute('data-color', this.data.color);

    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'callout-block__icon-btn';
    iconBtn.textContent = this.data.icon;
    iconBtn.title = '아이콘 변경';
    if (!this.readOnly) {
      iconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        iconBtn.setAttribute('data-emoji-trigger', '');
        UI.openEmojiPicker(iconBtn, (emoji) => { iconBtn.textContent = emoji; this.data.icon = emoji; Workspace.markDirty(); });
      });
    }

    const text = document.createElement('div');
    text.className = 'callout-block__text';
    text.contentEditable = this.readOnly ? 'false' : 'true';
    text.innerHTML = this.data.text || '';
    if (!this.data.text) text.setAttribute('data-placeholder', '내용을 입력하세요...');
    text.addEventListener('input', () => Workspace.markDirty());

    wrapper.appendChild(iconBtn);
    wrapper.appendChild(text);

    if (!this.readOnly) {
      const colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'callout-block__color-btn';
      colorBtn.setAttribute('aria-label', '색상 변경');
      colorBtn.title = '색상 변경';
      colorBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>';
      colorBtn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleColorPicker(wrapper, colorBtn); });
      wrapper.appendChild(colorBtn);
    }
    return wrapper;
  }

  _toggleColorPicker(wrapper, anchor) {
    const existing = document.querySelector('.callout-block__color-picker');
    if (existing) { existing.remove(); return; }

    const picker = document.createElement('div');
    picker.className = 'callout-block__color-picker';
    CalloutTool.COLORS.forEach(color => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'callout-color-swatch';
      swatch.setAttribute('data-color', color);
      swatch.title = color;
      if (color === wrapper.getAttribute('data-color')) swatch.classList.add('active');
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.setAttribute('data-color', color);
        this.data.color = color;
        picker.remove();
        Workspace.markDirty();
      });
      picker.appendChild(swatch);
    });

    const rect = anchor.getBoundingClientRect();
    Object.assign(picker.style, { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: '9999' });
    document.body.appendChild(picker);

    const close = (e) => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  save(blockContent) {
    return {
      text:  blockContent.querySelector('.callout-block__text')?.innerHTML || '',
      icon:  blockContent.querySelector('.callout-block__icon-btn')?.textContent || '💡',
      color: blockContent.getAttribute('data-color') || 'blue',
    };
  }

  static get sanitize() {
    return { text: { b: true, strong: true, i: true, em: true, u: true, a: { href: true, target: true, rel: true }, code: true, mark: true, br: true } };
  }
}

/* =========================================================
   IMAGE (Storage 기반)
========================================================= */
class DarakImageTool {
  static get toolbox() {
    return {
      title: '이미지',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.data = data ? { ...data } : {};
    this.readOnly = readOnly;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-block';
    if (this.data.fileId) this._renderImage(wrapper, this.data.fileId);
    else this._renderUploadArea(wrapper);
    return wrapper;
  }

  _renderUploadArea(wrapper) {
    wrapper.innerHTML = `
      <div class="image-block__upload-area">
        <span class="image-block__upload-icon">🖼️</span>
        <span class="image-block__upload-text">클릭하거나 이미지를 드래그하세요</span>
        <span class="image-block__upload-hint">최대 10MB · JPG, PNG, GIF, WebP</span>
        <input type="file" accept="image/*" style="display:none" />
      </div>`;
    const area = wrapper.querySelector('.image-block__upload-area');
    const input = wrapper.querySelector('input[type=file]');
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => { const f = e.target.files?.[0]; if (f) await this._uploadFile(wrapper, f); });
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', async (e) => {
      e.preventDefault(); area.classList.remove('drag-over');
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith('image/')) await this._uploadFile(wrapper, f);
    });
    wrapper.addEventListener('paste', async (e) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) await this._uploadFile(wrapper, f); }
    });
  }

  async _uploadFile(wrapper, file) {
    if (file.size > 10 * 1024 * 1024) { UI.toast('이미지 파일이 10MB를 초과합니다.', 'warning'); return; }
    wrapper.innerHTML = '<div class="image-block__uploading"><div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>이미지 업로드 중...</div>';
    try {
      const { fileId } = await Storage.uploadImage(file);
      this.data.fileId = fileId;
      await this._renderImage(wrapper, fileId);
      Workspace.markDirty();
    } catch (e) {
      console.error('이미지 업로드 실패:', e);
      UI.toast(e.message || '이미지 업로드에 실패했습니다.', 'error');
      this._renderUploadArea(wrapper);
    }
  }

  async _renderImage(wrapper, fileId) {
    wrapper.innerHTML = '<div class="image-block__uploading"><div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>이미지 로드 중...</div>';
    try {
      const url = await EditorManager.loadImage(fileId);
      wrapper.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'image-block__img';
      img.src = url;
      img.alt = this.data.caption || '이미지';
      const caption = document.createElement('div');
      caption.className = 'image-block__caption';
      caption.contentEditable = this.readOnly ? 'false' : 'true';
      caption.textContent = this.data.caption || '';
      if (!this.data.caption) caption.setAttribute('data-placeholder', '캡션 추가...');
      caption.addEventListener('input', () => Workspace.markDirty());
      wrapper.appendChild(img);
      wrapper.appendChild(caption);
    } catch (e) {
      console.error('이미지 로드 실패:', e);
      wrapper.innerHTML = '<div class="image-block__upload-area" style="border-color:var(--color-danger);cursor:default">❌ 이미지를 불러올 수 없습니다</div>';
    }
  }

  save(blockContent) {
    return {
      fileId: this.data.fileId || null,
      caption: blockContent.querySelector('.image-block__caption')?.textContent || '',
    };
  }
}

/* =========================================================
   PAGE LINK (하위 문서)
========================================================= */
class PageLinkTool {
  static get toolbox() {
    return {
      title: '하위 문서',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.data = data ? { ...data } : {};
    this.readOnly = readOnly;
    this._isCreating = false;
  }

  render() {
    const wrapper = document.createElement('div');
    if (this.data.pageId) this._renderLink(wrapper, this.data.pageId);
    else this._createChildPage(wrapper);
    return wrapper;
  }

  _renderLink(wrapper, pageId) {
    const meta = Workspace.getPageMeta(pageId);
    const title = meta?.title || '알 수 없는 페이지';
    const icon = meta?.icon || '📄';
    wrapper.innerHTML = `
      <div class="page-link-block" role="link" tabindex="0">
        <span class="page-link-block__icon">${icon}</span>
        <span class="page-link-block__title">${UI.escapeHtml(title)}</span>
        <span class="page-link-block__arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>`;
    const link = wrapper.querySelector('.page-link-block');
    const go = () => App.navigateToPage(pageId);
    link.addEventListener('click', go);
    link.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  async _createChildPage(wrapper) {
    if (this._isCreating) return;
    const parentId = Workspace.getCurrentPageId();
    if (!parentId) { wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">먼저 페이지를 선택하세요</div>'; return; }
    this._isCreating = true;
    wrapper.innerHTML = '<div class="page-link-block page-link-block--creating"><span class="page-link-block__icon">📄</span><span class="page-link-block__title">하위 문서를 만드는 중...</span></div>';
    try {
      const result = await Workspace.createPage(parentId, { title: '새 하위 문서' });
      if (!result) { wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">하위 문서를 만들 수 없습니다</div>'; return; }
      this.data.pageId = result.meta.id;
      this._renderLink(wrapper, result.meta.id);
      if (Sidebar.expandPage) await Sidebar.expandPage(parentId); else Sidebar.render();
      Workspace.markDirty();
      UI.toast('하위 문서가 생성됐습니다. 현재 페이지를 저장하면 연결이 유지됩니다.', 'success', 5000);
    } catch (e) {
      console.error('하위 문서 생성 실패:', e);
      wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">하위 문서 생성 실패</div>';
      UI.toast('하위 문서를 만드는 데 실패했습니다.', 'error');
    } finally { this._isCreating = false; }
  }

  save() { return { pageId: this.data.pageId || null }; }
}

/* =========================================================
   BOOKMARK (웹 북마크 카드) — 신규
========================================================= */
class BookmarkTool {
  static get toolbox() {
    return {
      title: '북마크',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.data = { url: data?.url || '', title: data?.title || '', description: data?.description || '' };
    this.readOnly = readOnly;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'bookmark-block';
    if (this.data.url) this._renderCard(wrapper);
    else this._renderForm(wrapper);
    return wrapper;
  }

  _renderForm(wrapper) {
    wrapper.innerHTML = `
      <div class="bookmark-block__form">
        <span class="bookmark-block__form-icon">🔗</span>
        <input class="bookmark-block__input" type="url" placeholder="링크 URL 붙여넣기 (https://...)" />
        <button class="bookmark-block__btn" type="button">추가</button>
      </div>`;
    const input = wrapper.querySelector('input');
    const btn = wrapper.querySelector('button');
    const submit = () => {
      const url = this._normalize(input.value.trim());
      if (!url) { UI.toast('올바른 URL을 입력하세요.', 'warning'); return; }
      this.data.url = url;
      if (!this.data.title) this.data.title = this._hostname(url);
      this._renderCard(wrapper);
      Workspace.markDirty();
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    setTimeout(() => input.focus(), 0);
  }

  _renderCard(wrapper) {
    const url = this.data.url;
    const host = this._hostname(url);
    wrapper.innerHTML = `
      <div class="bookmark-block__card">
        <div class="bookmark-block__body">
          <div class="bookmark-block__title" contenteditable="${this.readOnly ? 'false' : 'true'}" data-placeholder="제목">${UI.escapeHtml(this.data.title || host)}</div>
          <div class="bookmark-block__url"><img class="bookmark-block__favicon" alt="" src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host)}" />${UI.escapeHtml(host)}</div>
        </div>
        <button class="bookmark-block__open" type="button" title="새 탭에서 열기" aria-label="열기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>`;
    const card = wrapper.querySelector('.bookmark-block__card');
    const titleEl = wrapper.querySelector('.bookmark-block__title');
    const openBtn = wrapper.querySelector('.bookmark-block__open');
    const fav = wrapper.querySelector('.bookmark-block__favicon');
    const open = () => window.open(url, '_blank', 'noopener');
    openBtn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    card.addEventListener('click', (e) => { if (!e.target.closest('.bookmark-block__title')) open(); });
    titleEl.addEventListener('input', () => { this.data.title = titleEl.textContent; Workspace.markDirty(); });
    titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    if (fav) fav.addEventListener('error', () => { fav.style.display = 'none'; });
  }

  _normalize(u) {
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); return u; } catch { return ''; }
  }
  _hostname(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

  save(blockContent) {
    return {
      url: this.data.url,
      title: blockContent.querySelector('.bookmark-block__title')?.textContent || this.data.title,
      description: this.data.description || '',
    };
  }
  static get sanitize() { return { url: false, title: false, description: false }; }
}

/* =========================================================
   TABLE OF CONTENTS (목차) — 신규
========================================================= */
class TableOfContentsTool {
  static get toolbox() {
    return {
      title: '목차',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    };
  }

  constructor({ readOnly }) {
    this.readOnly = readOnly;
    this._wrapper = null;
    // 에디터가 파괴되어 블록이 DOM에서 떨어지면 리스너를 자가 정리
    this._onChange = () => {
      if (!this._wrapper || !this._wrapper.isConnected) {
        document.removeEventListener('darakbang:editorChanged', this._onChange);
        return;
      }
      this._build();
    };
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'toc-block';
    this._wrapper = wrapper;
    this._build();
    // 에디터 내용 변경 시 자동 갱신 (페이지 전환 시 리스너 정리는 editor.destroy에서)
    document.addEventListener('darakbang:editorChanged', this._onChange);
    return wrapper;
  }

  _headers() {
    const ed = EditorManager.instance;
    const out = [];
    if (!ed || !ed.blocks) return out;
    const count = ed.blocks.getBlocksCount();
    for (let i = 0; i < count; i++) {
      const b = ed.blocks.getBlockByIndex(i);
      if (b && b.name === 'header') {
        const txt = (b.holder?.textContent || '').trim();
        if (txt) out.push({ index: i, text: txt, level: this._level(b) });
      }
    }
    return out;
  }

  _level(b) {
    const h = b.holder?.querySelector('h1,h2,h3,h4,h5,h6');
    return h ? parseInt(h.tagName[1], 10) : 2;
  }

  _build() {
    const w = this._wrapper;
    if (!w) return;
    const items = this._headers();
    if (!items.length) {
      w.innerHTML = '<div class="toc-block__empty">제목(헤더) 블록을 추가하면 목차가 자동으로 만들어집니다. <button class="toc-block__refresh" type="button">새로고침</button></div>';
    } else {
      w.innerHTML =
        '<div class="toc-block__head"><span class="toc-block__label">목차</span><button class="toc-block__refresh" type="button" title="새로고침" aria-label="새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button></div>' +
        '<ul class="toc-block__list">' +
        items.map(it => `<li class="toc-block__item toc-lv${it.level}" data-index="${it.index}" tabindex="0">${UI.escapeHtml(it.text)}</li>`).join('') +
        '</ul>';
    }
    w.querySelector('.toc-block__refresh')?.addEventListener('click', (e) => { e.stopPropagation(); this._build(); });
    w.querySelectorAll('.toc-block__item').forEach(li => {
      const go = () => {
        const idx = parseInt(li.dataset.index, 10);
        EditorManager.instance?.blocks.getBlockByIndex(idx)?.holder?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  save() { return {}; }
  static get sanitize() { return {}; }
}

/* =========================================================
   ATTACHMENT (파일 첨부 — PDF/Word/Excel/hwp 등) — 신규 v3
========================================================= */
class AttachmentTool {
  static get toolbox() {
    return {
      title: '파일',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    };
  }

  static fileEmoji(name = '', mime = '') {
    const ext = (String(name).split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return '📕';
    if (/^(docx?|hwpx?|odt|rtf)$/.test(ext)) return '📝';
    if (/^(xlsx?|xlsm|xlsb|csv|ods)$/.test(ext)) return '📊';
    if (/^(pptx?|odp|key)$/.test(ext)) return '📙';
    if (/^(zip|rar|7z|tar|gz)$/.test(ext)) return '🗜️';
    if (/^(txt|md|log)$/.test(ext)) return '📄';
    if (/^(jpe?g|png|gif|webp|svg|bmp|heic)$/.test(ext)) return '🖼️';
    if (/^(mp3|wav|flac|m4a|ogg|aac)$/.test(ext)) return '🎵';
    if (/^(mp4|mov|avi|mkv|webm)$/.test(ext)) return '🎬';
    if (/word/.test(mime)) return '📝';
    if (/sheet|excel/.test(mime)) return '📊';
    if (/pdf/.test(mime)) return '📕';
    return '📎';
  }

  static fmtSize(bytes) {
    if (bytes == null || isNaN(bytes)) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0, n = Number(bytes);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
  }

  constructor({ data, readOnly }) {
    this.data = data ? { ...data } : {};
    this.readOnly = readOnly;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-block';
    if (this.data.fileId) this._renderCard(wrapper);
    else this._renderUploadArea(wrapper);
    return wrapper;
  }

  _maxBytes() { return Storage.isDemo() ? 2 * 1024 * 1024 : 50 * 1024 * 1024; }

  _renderUploadArea(wrapper) {
    const limit = Storage.isDemo() ? '데모 모드 최대 2MB' : '최대 50MB';
    wrapper.innerHTML = `
      <div class="attachment-block__upload">
        <span class="attachment-block__upload-icon">📎</span>
        <span class="attachment-block__upload-text">클릭하거나 파일을 드래그하세요</span>
        <span class="attachment-block__upload-hint">PDF · Word · Excel · PPT · hwp · zip 등 · ${limit}</span>
        <input type="file" style="display:none" />
      </div>`;
    const area = wrapper.querySelector('.attachment-block__upload');
    const input = wrapper.querySelector('input[type=file]');
    if (this.readOnly) { area.style.pointerEvents = 'none'; return; }
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => { const f = e.target.files?.[0]; if (f) await this._upload(wrapper, f); });
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', async (e) => {
      e.preventDefault(); area.classList.remove('drag-over');
      const f = e.dataTransfer.files?.[0];
      if (f) await this._upload(wrapper, f);
    });
  }

  async _upload(wrapper, file) {
    if (file.size > this._maxBytes()) {
      UI.toast(`파일이 너무 큽니다. (${AttachmentTool.fmtSize(file.size)} · 한도 ${AttachmentTool.fmtSize(this._maxBytes())})`, 'warning', 5000);
      return;
    }
    wrapper.innerHTML = '<div class="attachment-block__loading"><div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>파일 업로드 중...</div>';
    try {
      const meta = await Storage.uploadFile(file);
      this.data = { fileId: meta.fileId, name: meta.name, size: meta.size, mime: meta.mime, caption: this.data.caption || '' };
      this._renderCard(wrapper);
      Workspace.markDirty();
      document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
    } catch (e) {
      console.error('파일 업로드 실패:', e);
      UI.toast(e.message || '파일 업로드에 실패했습니다.', 'error', 6000);
      this._renderUploadArea(wrapper);
    }
  }

  _renderCard(wrapper) {
    const emoji = AttachmentTool.fileEmoji(this.data.name, this.data.mime);
    const size = AttachmentTool.fmtSize(this.data.size);
    wrapper.innerHTML = `
      <div class="attachment-block__card" role="group">
        <span class="attachment-block__icon">${emoji}</span>
        <div class="attachment-block__meta">
          <div class="attachment-block__name" title="${UI.escapeHtml(this.data.name || '첨부파일')}">${UI.escapeHtml(this.data.name || '첨부파일')}</div>
          <div class="attachment-block__sub">${size ? UI.escapeHtml(size) : ''}</div>
        </div>
        <button class="attachment-block__download" type="button" title="다운로드" aria-label="다운로드">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>`;
    const btn = wrapper.querySelector('.attachment-block__download');
    const card = wrapper.querySelector('.attachment-block__card');
    btn.addEventListener('click', (e) => { e.stopPropagation(); this._download(); });
    card.addEventListener('click', () => this._download());
  }

  async _download() {
    if (!this.data.fileId) return;
    const t = UI.toast('파일을 준비하는 중...', 'info', 15000);
    try {
      const url = await Storage.getFileBlobUrl(this.data.fileId);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.data.name || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (typeof url === 'string' && url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 1500);
      t?.remove();
    } catch (e) {
      console.error('다운로드 실패:', e);
      t?.remove();
      UI.toast('파일을 불러오지 못했습니다.', 'error');
    }
  }

  save() {
    return {
      fileId: this.data.fileId || null,
      name: this.data.name || '',
      size: this.data.size || 0,
      mime: this.data.mime || '',
      caption: this.data.caption || '',
    };
  }
  static get sanitize() { return { fileId: false, name: false, size: false, mime: false, caption: false }; }
}

/* =========================================================
   TABLE (표 + 함수 통합) — v4
   · 기존 '표' 디자인(전체폭, 기본 2×2)을 따르고, 셀에 =SUM(A1:A3) 등 함수를 쓰면 계산.
   · 수식 입력 시(셀이 '='로 시작) 열(A·B·C)/행(1·2·3) 좌표 + 함수 힌트가 옅게 나타남(표 크기 불변).
   · 행/열 추가는 표 오른쪽/아래의 ＋ 버튼으로(추가가 끝에). 머리글·천단위콤마·행열삭제는 블록 설정(⠿)에서.
   · 데이터: { withHeadings, content:[[..]], useThousands }. 옛 계산표 { cells } 도 읽음.
========================================================= */
class TableTool {
  static get toolbox() {
    return {
      title: '표',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    const d = data || {};
    const src = Array.isArray(d.content) ? d.content : (Array.isArray(d.cells) ? d.cells : null);
    this._isNew = !src;                                    // 새로 추가된 표인지
    this._grid = this._normalize(src);
    this._withHeadings = d.withHeadings !== undefined ? !!d.withHeadings : true;   // 새 표는 머리글 ON (기존 표와 동일)
    // 천단위 콤마: 켜면 '표 전체' 숫자를 반올림(정수)+콤마로 표시. 직접 입력값이 갑자기 바뀌지 않도록 기본 OFF.
    this._thousands   = d.useThousands !== undefined ? !!d.useThousands : false;
    this._block = null;
    this._lastCell = null;                                 // 마지막 포커스 셀(설정 메뉴 행/열 삭제 기준)
  }

  _normalize(src) {
    let c = Array.isArray(src) && src.length
      ? src.map(r => Array.isArray(r) ? r.slice() : [])
      : [['', ''], ['', '']];                              // 기본 2×2 (전체폭으로 표시)
    const cols = Math.max(1, ...c.map(r => r.length));
    c = c.map(r => { const row = r.map(v => (v == null ? '' : String(v))); while (row.length < cols) row.push(''); return row; });
    return c;
  }

  get _rows() { return this._grid.length; }
  get _cols() { return this._grid[0] ? this._grid[0].length : 0; }

  /* 표시값:
     - ' 로 시작 → 텍스트 고유값(나머지 그대로)
     - 수식 → 계산결과
     - 그 외 → 원문
     천단위 콤마(표 전체 옵션)가 켜지면 '숫자로 보이는 모든 값'을 반올림(정수)+콤마로 표시. */
  _display(r, c) {
    const raw = (this._grid[r] && this._grid[r][c]) || '';
    if (typeof raw === 'string' && raw.startsWith("'")) return raw.slice(1);   // 텍스트
    if (Formula.isFormula(raw)) return this._fmtNum(Formula.displayValue(this._grid, r, c));
    return this._fmtNum(raw);
  }
  // 천단위 옵션이 켜져 있고 값이 숫자처럼 보이면 → 반올림(소수점 생략) + 콤마. 아니면 원문.
  _fmtNum(s) {
    if (s === '#ERR' || s === '' || s == null) return s;
    if (!this._thousands) return s;
    const str = String(s).trim();
    if (!/^-?\d[\d,]*(\.\d+)?$/.test(str)) return s;          // 숫자 형태가 아니면 텍스트로 둠
    const n = Number(str.replace(/,/g, ''));
    if (!isFinite(n)) return s;
    return Math.round(n).toLocaleString('en-US');             // 반올림 + 천단위 콤마
  }

  render() {
    const block = document.createElement('div');
    block.className = 'table-block';
    this._block = block;
    this._renderAll();
    return block;
  }

  _renderAll() {
    const w = this._block;
    if (!w) return;
    w.innerHTML = '';
    w.classList.toggle('with-headings', this._withHeadings);

    // [표 + 오른쪽 열추가 버튼] 가로 묶음
    const grid = document.createElement('div');
    grid.className = 'table-block__grid';

    const scroll = document.createElement('div');
    scroll.className = 'table-block__scroll';
    const table = document.createElement('table');
    table.className = 'table-block__table';
    const tbody = document.createElement('tbody');
    for (let r = 0; r < this._rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this._cols; c++) tr.appendChild(this._cellTd(r, c));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    grid.appendChild(scroll);

    if (!this.readOnly) grid.appendChild(this._addBtn('col'));   // 오른쪽: 열 추가
    w.appendChild(grid);
    if (!this.readOnly) {
      w.appendChild(this._addBtn('row'));      // 아래: 행 추가
      w.appendChild(this._bar());              // 호버 시 보이는 컴팩트 툴바(머리글·천단위·행열 삭제)
    }

    // 좌표 라벨 (수식 입력 시에만 보임 — 오버레이)
    this._colLabels = document.createElement('div');
    this._colLabels.className = 'table-block__labels table-block__labels--col';
    this._rowLabels = document.createElement('div');
    this._rowLabels.className = 'table-block__labels table-block__labels--row';
    for (let c = 0; c < this._cols; c++) { const s = document.createElement('span'); s.textContent = Formula.colName(c); this._colLabels.appendChild(s); }
    for (let r = 0; r < this._rows; r++) { const s = document.createElement('span'); s.textContent = String(r + 1); this._rowLabels.appendChild(s); }
    w.appendChild(this._colLabels);
    w.appendChild(this._rowLabels);

    // 함수 힌트 (수식 입력 시에만) — 가능한 기능만 명확히
    const hint = document.createElement('div');
    hint.className = 'table-block__hint';
    hint.innerHTML = '함수 <b>=SUM · AVERAGE · MAX · MIN · COUNT · PRODUCT · ROUND · ABS</b> &nbsp;|&nbsp; 사칙연산 <b>+ − × ÷ ( )</b> &nbsp;|&nbsp; 범위 <b>A1:B3</b> &nbsp;|&nbsp; 맨 앞 <b>\'</b> → 그대로 텍스트';
    w.appendChild(hint);

    this._recalcAll();
  }

  _addBtn(kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'table-block__add table-block__add--' + kind;
    b.title = kind === 'col' ? '열 추가' : '행 추가';
    b.setAttribute('aria-label', b.title);
    b.textContent = '+';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (kind === 'col') this._grid.forEach(row => row.push(''));
      else this._grid.push(Array(this._cols).fill(''));
      Workspace.markDirty();
      this._renderAll();
    });
    return b;
  }

  _cellTd(r, c) {
    const td = document.createElement('td');
    td.className = 'table-block__cell';
    if (this._withHeadings && r === 0) td.classList.add('is-head');
    td.dataset.r = r; td.dataset.c = c;
    td.contentEditable = this.readOnly ? 'false' : 'true';
    td.spellcheck = false;
    td.textContent = this._display(r, c);
    if (this.readOnly) return td;

    td.addEventListener('focus', () => {
      this._lastCell = { r, c };
      const raw = this._grid[r][c] || '';
      if (td.textContent !== raw) td.textContent = raw;
      this._setFormulaMode(Formula.isFormula(raw));
    });
    td.addEventListener('input', () => {
      this._grid[r][c] = td.textContent;
      this._setFormulaMode(Formula.isFormula(td.textContent));
      this._recalcAll(td);
      Workspace.markDirty();
    });
    td.addEventListener('blur', () => {
      this._grid[r][c] = td.textContent.trim();
      this._setFormulaMode(false);
      td.textContent = this._display(r, c);
      this._recalcAll();
    });
    td.addEventListener('keydown', (e) => this._onCellKey(e, r, c));
    return td;
  }

  // 셀 (nr,nc) 로 포커스 이동. atStart=true 면 커서를 맨 앞, 아니면 맨 뒤로.
  _focusCell(nr, nc, atStart) {
    const t = this._block.querySelector(`.table-block__cell[data-r="${nr}"][data-c="${nc}"]`);
    if (!t) return false;
    t.focus();
    const sel = window.getSelection(); const range = document.createRange();
    range.selectNodeContents(t); range.collapse(!!atStart);
    sel.removeAllRanges(); sel.addRange(range);
    return true;
  }
  _caretAtStart(td) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return true;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const probe = range.cloneRange();
    probe.selectNodeContents(td); probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length === 0;
  }
  _caretAtEnd(td) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return true;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const probe = range.cloneRange();
    probe.selectNodeContents(td); probe.setStart(range.endContainer, range.endOffset);
    return probe.toString().length === 0;
  }

  // 엑셀식 이동: Enter(아래) / Tab(오른쪽, Shift+Tab 왼쪽) / 방향키.
  // 방향키 좌우는 셀 안에서 커서 이동하되 끝에 닿으면 옆 셀로. 상하는 위/아래 셀로.
  _onCellKey(e, r, c) {
    const td = e.target;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };  // Editor.js 가 Enter 로 새 줄/블록 만드는 것 차단

    if (e.key === 'Enter') {
      stop();                                   // 표 위에 빈 줄 생기던 문제 해결
      if (r + 1 < this._rows) this._focusCell(r + 1, c, true);
      else td.blur();                           // 마지막 행이면 입력 완료(커밋)
    } else if (e.key === 'Tab') {
      stop();
      if (e.shiftKey) { if (c - 1 >= 0) this._focusCell(r, c - 1, false); else if (r - 1 >= 0) this._focusCell(r - 1, this._cols - 1, false); }
      else { if (c + 1 < this._cols) this._focusCell(r, c + 1, true); else if (r + 1 < this._rows) this._focusCell(r + 1, 0, true); }
    } else if (e.key === 'ArrowUp') {
      if (r - 1 >= 0) { stop(); this._focusCell(r - 1, c, false); }
    } else if (e.key === 'ArrowDown') {
      if (r + 1 < this._rows) { stop(); this._focusCell(r + 1, c, true); }
    } else if (e.key === 'ArrowLeft') {
      if (this._caretAtStart(td) && c - 1 >= 0) { stop(); this._focusCell(r, c - 1, false); }
      // 그 외엔 기본 동작(셀 안에서 커서 왼쪽 이동)
    } else if (e.key === 'ArrowRight') {
      if (this._caretAtEnd(td) && c + 1 < this._cols) { stop(); this._focusCell(r, c + 1, true); }
    }
  }

  _setFormulaMode(on) {
    if (!this._block) return;
    this._block.classList.toggle('formula-editing', on);
    if (on) this._positionLabels();
  }

  _positionLabels() {
    if (!this._block || !this._colLabels) return;
    const base = this._block.getBoundingClientRect();
    const colSpans = this._colLabels.children;
    const rowSpans = this._rowLabels.children;
    for (let c = 0; c < this._cols; c++) {
      const cell = this._block.querySelector(`.table-block__cell[data-r="0"][data-c="${c}"]`);
      if (cell && colSpans[c]) { const rc = cell.getBoundingClientRect(); colSpans[c].style.left = (rc.left - base.left + rc.width / 2) + 'px'; }
    }
    for (let r = 0; r < this._rows; r++) {
      const cell = this._block.querySelector(`.table-block__cell[data-r="${r}"][data-c="0"]`);
      if (cell && rowSpans[r]) { const rc = cell.getBoundingClientRect(); rowSpans[r].style.top = (rc.top - base.top + rc.height / 2) + 'px'; }
    }
  }

  _recalcAll(skipTd) {
    const w = this._block;
    if (!w) return;
    w.querySelectorAll('.table-block__cell').forEach(td => {
      if (td === skipTd || td === document.activeElement) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      td.textContent = this._display(r, c);
    });
  }

  /* 호버 시 보이는 컴팩트 툴바: 머리글 / 천단위 콤마 / 행·열 삭제 */
  _bar() {
    const bar = document.createElement('div');
    bar.className = 'table-block__bar';
    const mk = (label, title, active, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'table-block__bar-btn' + (active ? ' is-active' : '');
      b.textContent = label; b.title = title;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    bar.appendChild(mk('머리글', '첫 행을 머리글로', this._withHeadings,
      () => { this._withHeadings = !this._withHeadings; Workspace.markDirty(); this._renderAll(); }));
    bar.appendChild(mk('1,000', '천단위 콤마 · 소수점 반올림 (표 전체 숫자에 적용)', this._thousands,
      () => { this._thousands = !this._thousands; Workspace.markDirty(); this._renderAll(); }));
    bar.appendChild(mk('⌫행', '행 삭제(선택 셀 기준)', false, () => this._deleteRow()));
    bar.appendChild(mk('⌫열', '열 삭제(선택 셀 기준)', false, () => this._deleteCol()));
    return bar;
  }

  _deleteRow() {
    if (this._rows <= 1) return;
    const r = this._lastCell ? Math.min(this._lastCell.r, this._rows - 1) : this._rows - 1;
    this._grid.splice(r, 1);
    this._lastCell = null;
    Workspace.markDirty();
    this._renderAll();
  }
  _deleteCol() {
    if (this._cols <= 1) return;
    const c = this._lastCell ? Math.min(this._lastCell.c, this._cols - 1) : this._cols - 1;
    this._grid.forEach(row => row.splice(c, 1));
    this._lastCell = null;
    Workspace.markDirty();
    this._renderAll();
  }

  save() {
    if (this._block) {
      const active = document.activeElement;
      if (active && active.classList && active.classList.contains('table-block__cell') && this._block.contains(active)) {
        const r = +active.dataset.r, c = +active.dataset.c;
        this._grid[r][c] = active.textContent.trim();
      }
    }
    return { withHeadings: this._withHeadings, content: this._grid, useThousands: this._thousands };
  }

  static get sanitize() { return { withHeadings: false, content: false, useThousands: false }; }
}
