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
   SPREADSHEET (계산표 — sum/average/max/min 등 함수) — 신규 v3
   · 셀에 =SUM(A1:A3), =AVERAGE(B1:B4), =A1+B2*2 처럼 입력하면 계산
   · 기존 '표' 블록은 그대로 두고, 함수가 필요할 때 쓰는 별도 블록
========================================================= */
class SpreadsheetTool {
  static get toolbox() {
    return {
      title: '계산표',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    };
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this._cells = this._normalize(data && data.cells);
    this._wrapper = null;
  }

  _normalize(cells) {
    let c = Array.isArray(cells) && cells.length
      ? cells.map(r => Array.isArray(r) ? r.slice() : [])
      : [['', '', ''], ['', '', ''], ['', '', '']];
    const cols = Math.max(1, ...c.map(r => r.length));
    c = c.map(r => { const row = r.map(v => (v == null ? '' : String(v))); while (row.length < cols) row.push(''); return row; });
    return c;
  }

  get _rows() { return this._cells.length; }
  get _cols() { return this._cells[0] ? this._cells[0].length : 0; }

  /* ---- 좌표 유틸 ---- */
  static colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  static colIndex(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'spreadsheet-block';
    this._wrapper = wrapper;
    this._renderAll();
    return wrapper;
  }

  _renderAll() {
    const w = this._wrapper;
    if (!w) return;
    w.innerHTML = '';

    const scroll = document.createElement('div');
    scroll.className = 'spreadsheet-block__scroll';
    const table = document.createElement('table');
    table.className = 'spreadsheet-block__table';

    // 헤더 (열 이름 A·B·C…)
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    htr.appendChild(this._cornerCell());
    for (let c = 0; c < this._cols; c++) {
      const th = document.createElement('th');
      th.className = 'spreadsheet-block__colhead';
      th.textContent = SpreadsheetTool.colName(c);
      htr.appendChild(th);
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    // 본문
    const tbody = document.createElement('tbody');
    for (let r = 0; r < this._rows; r++) {
      const tr = document.createElement('tr');
      const rh = document.createElement('th');
      rh.className = 'spreadsheet-block__rowhead';
      rh.textContent = String(r + 1);
      tr.appendChild(rh);
      for (let c = 0; c < this._cols; c++) tr.appendChild(this._cellTd(r, c));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    w.appendChild(scroll);

    if (!this.readOnly) w.appendChild(this._toolbar());
    this._recalcAll();
  }

  _cornerCell() {
    const th = document.createElement('th');
    th.className = 'spreadsheet-block__corner';
    th.textContent = 'ƒ';
    th.title = '계산표: 셀에 =SUM(A1:A3), =AVERAGE(...), =A1+B2 처럼 입력하세요';
    return th;
  }

  _cellTd(r, c) {
    const td = document.createElement('td');
    td.className = 'spreadsheet-block__cell';
    td.dataset.r = r; td.dataset.c = c;
    td.contentEditable = this.readOnly ? 'false' : 'true';
    td.spellcheck = false;
    td.textContent = this._display(r, c);
    if (this.readOnly) return td;

    td.addEventListener('focus', () => {
      const raw = this._cells[r][c] || '';
      if (td.textContent !== raw) td.textContent = raw;
      td.classList.toggle('is-formula', raw.startsWith('='));
    });
    td.addEventListener('input', () => {
      this._cells[r][c] = td.textContent;
      this._recalcAll(td);            // 입력 중인 칸은 건드리지 않음
      Workspace.markDirty();
    });
    td.addEventListener('blur', () => {
      this._cells[r][c] = td.textContent.trim();
      td.classList.remove('is-formula');
      td.textContent = this._display(r, c);
      this._recalcAll();
    });
    td.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); td.blur(); } });
    return td;
  }

  _toolbar() {
    const bar = document.createElement('div');
    bar.className = 'spreadsheet-block__toolbar';
    const mk = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spreadsheet-block__btn';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); Workspace.markDirty(); this._renderAll(); });
      return b;
    };
    bar.appendChild(mk('+행', '행 추가', () => this._cells.push(Array(this._cols).fill(''))));
    bar.appendChild(mk('−행', '마지막 행 삭제', () => { if (this._rows > 1) this._cells.pop(); }));
    bar.appendChild(mk('+열', '열 추가', () => this._cells.forEach(row => row.push(''))));
    bar.appendChild(mk('−열', '마지막 열 삭제', () => { if (this._cols > 1) this._cells.forEach(row => row.pop()); }));
    const hint = document.createElement('span');
    hint.className = 'spreadsheet-block__hint';
    hint.textContent = '=SUM, AVERAGE, MAX, MIN, COUNT, PRODUCT, +−×÷';
    bar.appendChild(hint);
    return bar;
  }

  /* ---- 표시값 ---- */
  _display(r, c) {
    const raw = (this._cells[r] && this._cells[r][c]) || '';
    if (typeof raw === 'string' && raw.trim().startsWith('=')) {
      try { return this._fmt(this._evalFormula(raw.trim().slice(1), new Set([r + ',' + c]))); }
      catch (e) { return '#ERR'; }
    }
    return raw;
  }

  _fmt(v) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '#ERR';
    if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
    return String(v);
  }

  _recalcAll(skipTd) {
    const w = this._wrapper;
    if (!w) return;
    w.querySelectorAll('.spreadsheet-block__cell').forEach(td => {
      if (td === skipTd || td === document.activeElement) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      td.textContent = this._display(r, c);
    });
  }

  /* ---- 셀의 숫자값 (수식 계산용) ---- */
  _cellNumber(r, c, visiting) {
    if (r < 0 || c < 0 || r >= this._rows || c >= this._cols) return NaN;
    const key = r + ',' + c;
    if (visiting.has(key)) throw new Error('순환참조');
    const raw = (this._cells[r][c] || '').trim();
    if (raw.startsWith('=')) {
      visiting.add(key);
      try { return this._evalFormula(raw.slice(1), visiting); }
      finally { visiting.delete(key); }
    }
    if (raw === '') return NaN;
    const n = Number(raw.replace(/,/g, ''));
    return isNaN(n) ? NaN : n;
  }

  /* ---- 수식 평가 (재귀하강 파서) ---- */
  _evalFormula(src, visiting) {
    const tokens = this._tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const self = this;

    function parseExpr() {
      let v = parseTerm();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = next().t; const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        const op = next().t; const r = parseFactor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function parseFactor() {
      const tk = peek();
      if (!tk) throw new Error('수식 오류');
      if (tk.t === '-') { next(); return -parseFactor(); }
      if (tk.t === '+') { next(); return parseFactor(); }
      if (tk.t === '(') { next(); const v = parseExpr(); expect(')'); return v; }
      if (tk.t === 'num') { next(); return tk.v; }
      if (tk.t === 'func') { return parseFunc(); }
      if (tk.t === 'cell') { next(); const n = self._cellNumber(tk.r, tk.c, visiting); return isNaN(n) ? 0 : n; }
      throw new Error('수식 오류');
    }
    function expect(t) { const tk = next(); if (!tk || tk.t !== t) throw new Error('괄호 오류'); }

    function gatherArg() {
      // 인자는 범위(A1:B2) 또는 일반 식
      if (peek() && peek().t === 'cell' && tokens[pos + 1] && tokens[pos + 1].t === ':') {
        const a = next(); next(); const b = next();   // cell ':' cell
        if (!b || b.t !== 'cell') throw new Error('범위 오류');
        const vals = [];
        const r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r);
        const c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
          const n = self._cellNumber(r, c, visiting);
          if (!isNaN(n)) vals.push(n);
        }
        return vals;
      }
      return [parseExpr()];
    }
    function parseFunc() {
      const fn = next().name;
      expect('(');
      let values = [];
      if (peek() && peek().t !== ')') {
        values = values.concat(gatherArg());
        while (peek() && peek().t === ',') { next(); values = values.concat(gatherArg()); }
      }
      expect(')');
      return applyFunc(fn, values);
    }
    function applyFunc(fn, vals) {
      const nums = vals.filter(v => typeof v === 'number' && !isNaN(v));
      switch (fn) {
        case 'SUM':     return nums.reduce((a, b) => a + b, 0);
        case 'AVERAGE':
        case 'AVG':     return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
        case 'MAX':     return nums.length ? Math.max(...nums) : NaN;
        case 'MIN':     return nums.length ? Math.min(...nums) : NaN;
        case 'COUNT':   return nums.length;
        case 'PRODUCT': return nums.length ? nums.reduce((a, b) => a * b, 1) : NaN;
        case 'ROUND': { const x = nums[0] || 0, d = nums[1] || 0, p = Math.pow(10, d); return Math.round(x * p) / p; }
        case 'ABS':     return Math.abs(nums[0] || 0);
        default: throw new Error('알 수 없는 함수: ' + fn);
      }
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error('수식 오류');
    return result;
  }

  _tokenize(src) {
    const tokens = [];
    let i = 0;
    const isLetter = (ch) => /[A-Za-z]/.test(ch);
    const isDigit = (ch) => /[0-9]/.test(ch);
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      if ('+-*/(),:'.includes(ch)) { tokens.push({ t: ch }); i++; continue; }
      if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
        let s = ''; while (i < src.length && /[0-9.]/.test(src[i])) s += src[i++];
        tokens.push({ t: 'num', v: parseFloat(s) }); continue;
      }
      if (isLetter(ch)) {
        let letters = ''; while (i < src.length && isLetter(src[i])) letters += src[i++];
        let digits = ''; while (i < src.length && isDigit(src[i])) digits += src[i++];
        if (digits) tokens.push({ t: 'cell', r: parseInt(digits, 10) - 1, c: SpreadsheetTool.colIndex(letters) });
        else tokens.push({ t: 'func', name: letters.toUpperCase() });
        continue;
      }
      throw new Error('알 수 없는 문자: ' + ch);
    }
    return tokens;
  }

  save() {
    if (this._wrapper) {
      this._wrapper.querySelectorAll('.spreadsheet-block__cell').forEach(td => {
        if (td === document.activeElement) {
          const r = +td.dataset.r, c = +td.dataset.c;
          this._cells[r][c] = td.textContent.trim();
        }
      });
    }
    return { cells: this._cells, rows: this._rows, cols: this._cols };
  }

  static get sanitize() { return { cells: false }; }
}
