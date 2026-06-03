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
