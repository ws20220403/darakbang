/**
 * editor.js — Editor.js 통합 + 커스텀 블록
 * 지원 블록: Paragraph, Header, Checklist, Quote, Delimiter,
 *             Toggle(커스텀), Callout(커스텀), Image(커스텀), ChildPage(커스텀)
 */

const EditorManager = (() => {

  let _editor = null;
  let _currentPageId = null;
  let _slashPopupOpen = false;
  let _blobUrlCache = {};   // fileId → blobUrl
  let _chromeGuardObserver = null;

  /* =========================================================
     커스텀 블록 — TOGGLE
  ========================================================= */
  class ToggleTool {
    static get toolbox() {
      return {
        title: '토글',
        // [버그수정] Editor.js toolbox icon은 SVG 문자열이어야 함
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
      };
    }

    constructor({ data, api, readOnly }) {
      this.data = data || { title: '', content: '' };
      this.api  = api;
      this.readOnly = readOnly;
      this._wrapper = null;
      this._isOpen  = data?.isOpen || false;
    }

    render() {
      const wrapper = document.createElement('div');
      wrapper.className = `toggle-block${this._isOpen ? ' is-open' : ''}`;

      const summary = document.createElement('div');
      summary.className = 'toggle-block__summary';

      const arrow = document.createElement('span');
      arrow.className = 'toggle-block__arrow';
      arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

      const title = document.createElement('div');
      title.className = 'toggle-block__title';
      title.contentEditable = this.readOnly ? 'false' : 'true';
      title.textContent = this.data.title || '';
      if (!this.data.title) title.setAttribute('data-placeholder', '토글 제목...');

      title.addEventListener('input', () => Workspace.markDirty());
      // 엔터 키로 내용 영역으로 이동
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!this._isOpen) {
            this._isOpen = true;
            wrapper.classList.add('is-open');
          }
          inner.focus();
        }
      });

      summary.appendChild(arrow);
      summary.appendChild(title);

      const content = document.createElement('div');
      content.className = 'toggle-block__content';

      const inner = document.createElement('div');
      inner.className = 'toggle-block__inner';
      inner.contentEditable = this.readOnly ? 'false' : 'true';
      inner.innerHTML = this.data.content || '';
      if (!this.data.content) inner.setAttribute('data-placeholder', '내용을 입력하세요...');
      inner.addEventListener('input', () => Workspace.markDirty());

      content.appendChild(inner);
      wrapper.appendChild(summary);
      wrapper.appendChild(content);

      // 화살표 클릭으로 열기/닫기 (제목 영역은 편집 우선)
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this._isOpen = !this._isOpen;
        wrapper.classList.toggle('is-open', this._isOpen);
      });

      this._wrapper = wrapper;
      return wrapper;
    }

    save(blockContent) {
      const title = blockContent.querySelector('.toggle-block__title');
      const inner = blockContent.querySelector('.toggle-block__inner');
      return {
        title:   title?.textContent || '',
        content: inner?.innerHTML   || '',
        isOpen:  this._isOpen,
      };
    }

    // Editor.js가 validate를 호출할 때 true 반환
    static validate(savedData) {
      return true;
    }
  }

  /* =========================================================
     커스텀 블록 — CALLOUT
  ========================================================= */
  class CalloutTool {
    static get toolbox() {
      return {
        title: '콜아웃',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      };
    }

    static get COLORS() {
      return ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple'];
    }

    constructor({ data, api, readOnly }) {
      this.data = {
        text:  data?.text  || '',
        icon:  data?.icon  || '💡',
        color: data?.color || 'blue',
      };
      this.api      = api;
      this.readOnly = readOnly;
      this._iconBtn = null;
      this._textEl  = null;
      this._wrapper = null;
    }

    render() {
      const wrapper = document.createElement('div');
      wrapper.className = 'callout-block';
      wrapper.setAttribute('data-color', this.data.color);
      this._wrapper = wrapper;

      // 아이콘 버튼
      const iconBtn = document.createElement('button');
      iconBtn.className = 'callout-block__icon-btn';
      iconBtn.setAttribute('type', 'button');
      iconBtn.textContent = this.data.icon;
      iconBtn.title = '아이콘 변경';
      this._iconBtn = iconBtn;

      if (!this.readOnly) {
        iconBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.openEmojiPicker(iconBtn, (emoji) => {
            iconBtn.textContent = emoji;
            this.data.icon = emoji;
            Workspace.markDirty();
          });
        });
      }

      // 텍스트 영역
      const text = document.createElement('div');
      text.className = 'callout-block__text';
      text.contentEditable = this.readOnly ? 'false' : 'true';
      text.innerHTML = this.data.text || '';
      if (!this.data.text) text.setAttribute('data-placeholder', '내용을 입력하세요...');
      text.addEventListener('input', () => Workspace.markDirty());
      this._textEl = text;

      wrapper.appendChild(iconBtn);
      wrapper.appendChild(text);

      // 색상 버튼 (읽기 전용 아닐 때만)
      if (!this.readOnly) {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'callout-block__color-btn';
        colorBtn.setAttribute('type', 'button');
        colorBtn.setAttribute('aria-label', '색상 변경');
        colorBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>';
        colorBtn.title = '색상 변경';

        colorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleColorPicker(wrapper, colorBtn);
        });

        wrapper.appendChild(colorBtn);
      }

      return wrapper;
    }

    _toggleColorPicker(wrapper, anchor) {
      // 이미 열려 있으면 닫기
      const existing = document.querySelector('.callout-block__color-picker');
      if (existing) { existing.remove(); return; }

      const picker = document.createElement('div');
      picker.className = 'callout-block__color-picker';

      CalloutTool.COLORS.forEach(color => {
        const swatch = document.createElement('button');
        swatch.className = 'callout-color-swatch';
        swatch.setAttribute('data-color', color);
        swatch.setAttribute('type', 'button');
        swatch.title = color;
        if (color === wrapper.getAttribute('data-color')) {
          swatch.classList.add('active');
        }
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          wrapper.setAttribute('data-color', color);
          this.data.color = color;
          picker.remove();
          Workspace.markDirty();
        });
        picker.appendChild(swatch);
      });

      // body에 붙여서 overflow 문제 방지
      const rect = anchor.getBoundingClientRect();
      picker.style.position = 'fixed';
      picker.style.top = `${rect.bottom + 4}px`;
      picker.style.left = `${rect.left}px`;
      picker.style.zIndex = '9999';
      document.body.appendChild(picker);

      const closePicker = (e) => {
        if (!picker.contains(e.target)) {
          picker.remove();
          document.removeEventListener('click', closePicker);
        }
      };
      setTimeout(() => document.addEventListener('click', closePicker), 0);
    }

    save(blockContent) {
      // [버그수정] icon은 _iconBtn에서, text는 _textEl에서 읽음
      const iconBtn = blockContent.querySelector('.callout-block__icon-btn');
      const textEl  = blockContent.querySelector('.callout-block__text');
      return {
        text:  textEl?.innerHTML   || '',
        icon:  iconBtn?.textContent || '💡',
        color: blockContent.getAttribute('data-color') || 'blue',
      };
    }

    static validate(savedData) {
      return true;
    }
  }

  /* =========================================================
     커스텀 블록 — IMAGE (Drive Blob URL)
  ========================================================= */
  class DarakImageTool {
    static get toolbox() {
      return {
        title: '이미지',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      };
    }

    constructor({ data, api, config, readOnly }) {
      this.data = data ? { ...data } : {};
      this.api  = api;
      this.config = config;
      this.readOnly = readOnly;
      this._wrapper = null;
    }

    render() {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-block';
      this._wrapper = wrapper;

      if (this.data.fileId) {
        // 비동기 렌더 (await 없이 호출 → 로딩 표시 후 교체)
        this._renderImage(wrapper, this.data.fileId);
      } else {
        this._renderUploadArea(wrapper);
      }

      return wrapper;
    }

    _renderUploadArea(wrapper) {
      wrapper.innerHTML = `
        <div class="image-block__upload-area">
          <span class="image-block__upload-icon">🖼️</span>
          <span class="image-block__upload-text">클릭하거나 이미지를 드래그하세요</span>
          <span class="image-block__upload-hint">최대 10MB · JPG, PNG, GIF, WebP</span>
          <input type="file" accept="image/*" style="display:none" />
        </div>
      `;

      const area  = wrapper.querySelector('.image-block__upload-area');
      const input = wrapper.querySelector('input[type=file]');

      area.addEventListener('click', () => input.click());

      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) await this._uploadFile(wrapper, file);
      });

      // 드래그 앤 드롭
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
      });
      area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
      area.addEventListener('drop', async (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          await this._uploadFile(wrapper, file);
        }
      });

      // 붙여넣기 (클립보드 이미지)
      wrapper.addEventListener('paste', async (e) => {
        const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
        if (item) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await this._uploadFile(wrapper, file);
        }
      });
    }

    async _uploadFile(wrapper, file) {
      if (file.size > 10 * 1024 * 1024) {
        UI.toast('이미지 파일이 10MB를 초과합니다.', 'warning');
        return;
      }

      wrapper.innerHTML = `
        <div class="image-block__uploading">
          <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
          이미지 업로드 중...
        </div>
      `;

      try {
        const { fileId } = await Drive.uploadImage(file);
        this.data.fileId = fileId;
        await this._renderImage(wrapper, fileId);
        Workspace.markDirty();
      } catch (e) {
        console.error('이미지 업로드 실패:', e);
        UI.toast('이미지 업로드에 실패했습니다.', 'error');
        this._renderUploadArea(wrapper);
      }
    }

    async _renderImage(wrapper, fileId) {
      wrapper.innerHTML = `
        <div class="image-block__uploading">
          <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
          이미지 로드 중...
        </div>
      `;

      try {
        if (!_blobUrlCache[fileId]) {
          _blobUrlCache[fileId] = await Drive.getImageBlobUrl(fileId);
        }
        const blobUrl = _blobUrlCache[fileId];

        wrapper.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'image-block__img';
        img.src = blobUrl;
        img.alt = '이미지';

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
        wrapper.innerHTML = `<div class="image-block__upload-area" style="border-color:var(--color-danger);cursor:default">❌ 이미지를 불러올 수 없습니다</div>`;
      }
    }

    save(blockContent) {
      const caption = blockContent.querySelector('.image-block__caption');
      return {
        fileId:  this.data.fileId || null,
        caption: caption?.textContent || '',
      };
    }

    static validate(savedData) {
      return true;
    }
  }

  /* =========================================================
     커스텀 블록 — CHILD PAGE
  ========================================================= */
  class PageLinkTool {
    static get toolbox() {
      return {
        title: '하위 문서',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      };
    }

    constructor({ data, api, readOnly }) {
      this.data = data ? { ...data } : {};
      this.api  = api;
      this.readOnly = readOnly;
      this._isCreating = false;
    }

    render() {
      const wrapper = document.createElement('div');

      if (this.data.pageId) {
        this._renderLink(wrapper, this.data.pageId);
      } else {
        this._createChildPage(wrapper);
      }

      return wrapper;
    }

    _renderLink(wrapper, pageId) {
      const meta = Workspace.getPageMeta(pageId);
      const title = meta?.title || '알 수 없는 페이지';
      const icon  = meta?.icon  || '📄';

      wrapper.innerHTML = `
        <div class="page-link-block" role="link" tabindex="0">
          <span class="page-link-block__icon">${icon}</span>
          <span class="page-link-block__title">${UI.escapeHtml(title)}</span>
          <span class="page-link-block__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      `;

      const link = wrapper.querySelector('.page-link-block');
      const navigate = () => App.navigateToPage(pageId);
      link.addEventListener('click', navigate);
      link.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(); });
    }

    async _createChildPage(wrapper) {
      if (this._isCreating) return;
      const parentId = Workspace.getCurrentPageId();
      if (!parentId) {
        wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">먼저 페이지를 선택하세요</div>';
        return;
      }

      this._isCreating = true;
      wrapper.innerHTML = `
        <div class="page-link-block page-link-block--creating">
          <span class="page-link-block__icon">📄</span>
          <span class="page-link-block__title">하위 문서를 만드는 중...</span>
        </div>
      `;

      try {
        const result = await Workspace.createPage(parentId, { title: '새 하위 문서' });
        if (!result) {
          wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">하위 문서를 만들 수 없습니다</div>';
          return;
        }

        this.data.pageId = result.meta.id;
        this._renderLink(wrapper, result.meta.id);
        if (Sidebar.expandPage) await Sidebar.expandPage(parentId);
        else Sidebar.render();
        Workspace.markDirty();
        UI.toast('하위 문서가 생성됐습니다. 현재 페이지를 저장하면 연결이 유지됩니다.', 'success', 5000);
      } catch (e) {
        console.error('하위 문서 생성 실패:', e);
        wrapper.innerHTML = '<div class="page-link-block page-link-block--disabled">하위 문서 생성 실패</div>';
        UI.toast('하위 문서를 만드는 데 실패했습니다.', 'error');
      } finally {
        this._isCreating = false;
      }
    }

    save(blockContent) {
      return { pageId: this.data.pageId || null };
    }

    static validate(savedData) {
      return true;
    }
  }

  /* =========================================================
     커스텀 블록 — TABLE (수식 지원)
  ========================================================= */
  class TableTool {
    static get toolbox() {
      return {
        title: '표',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
      };
    }

    constructor({ data, api, readOnly }) {
      this.api      = api;
      this.readOnly = readOnly;
      this.data = {
        withHeadings: data?.withHeadings ?? false,
        content:      data?.content?.length ? data.content : [['', '', ''], ['', '', ''], ['', '', '']],
      };
      this._wrapper = null;
    }

    /* ---------- 수식 평가 엔진 ---------- */
    static _colToNum(col) {
      let n = 0;
      for (let i = 0; i < col.length; i++) n = n * 26 + (col.toUpperCase().charCodeAt(i) - 64);
      return n; // A=1, B=2, ...
    }

    static _numToCol(n) {
      let s = '';
      while (n > 0) {
        s = String.fromCharCode(((n - 1) % 26) + 65) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    }

    _getCellRaw(colNum, rowNum) {
      const rowIdx = rowNum - 1;
      const colIdx = colNum - 1;
      const row    = this.data.content[rowIdx];
      if (!row) return '';
      const val = row[colIdx] ?? '';
      // 재귀 수식도 평가
      if (typeof val === 'string' && val.startsWith('=')) {
        return String(this._evalFormula(val.slice(1)));
      }
      return val;
    }

    _evalFormula(expr) {
      expr = expr.trim();
      const match = expr.match(/^([A-Z]+)\(([^)]*)\)$/i);
      if (!match) return '#FORMULA?';

      const func   = match[1].toUpperCase();
      const argsStr = match[2].trim();
      const values  = [];

      if (argsStr.includes(':')) {
        // 범위: A1:C3
        const parts    = argsStr.split(':');
        const startRef = parts[0].trim().match(/^([A-Za-z]+)(\d+)$/);
        const endRef   = parts[1].trim().match(/^([A-Za-z]+)(\d+)$/);
        if (!startRef || !endRef) return '#REF?';
        const c1 = TableTool._colToNum(startRef[1]), r1 = parseInt(startRef[2]);
        const c2 = TableTool._colToNum(endRef[1]),   r2 = parseInt(endRef[2]);
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const v = parseFloat(this._getCellRaw(c, r));
            if (!isNaN(v)) values.push(v);
          }
        }
      } else {
        // 개별 셀: A1,B2
        argsStr.split(',').forEach(ref => {
          const m = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
          if (!m) return;
          const v = parseFloat(this._getCellRaw(TableTool._colToNum(m[1]), parseInt(m[2])));
          if (!isNaN(v)) values.push(v);
        });
      }

      if (!values.length) return 0;
      switch (func) {
        case 'SUM':     return values.reduce((a, b) => a + b, 0);
        case 'AVERAGE': return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(10));
        case 'MAX':     return Math.max(...values);
        case 'MIN':     return Math.min(...values);
        case 'COUNT':   return values.length;
        default:        return '#NAME?';
      }
    }

    _evalDisplay(raw) {
      if (typeof raw === 'string' && raw.startsWith('=')) {
        const result = this._evalFormula(raw.slice(1));
        return String(result);
      }
      return raw ?? '';
    }

    /* ---------- 렌더 ---------- */
    render() {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-block';
      this._wrapper = wrapper;

      this._rebuildTable(wrapper);
      return wrapper;
    }

    _rebuildTable(wrapper) {
      wrapper.innerHTML = '';

      // 헤더 토글 버튼
      if (!this.readOnly) {
        const toolbar = document.createElement('div');
        toolbar.className = 'table-block__toolbar';

        const headingToggle = document.createElement('button');
        headingToggle.className = `table-block__btn${this.data.withHeadings ? ' active' : ''}`;
        headingToggle.type = 'button';
        headingToggle.title = '첫 행을 헤더로 사용';
        headingToggle.textContent = '헤더 행';
        headingToggle.addEventListener('click', () => {
          this.data.withHeadings = !this.data.withHeadings;
          headingToggle.classList.toggle('active', this.data.withHeadings);
          this._rebuildTable(wrapper);
          Workspace.markDirty();
        });

        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'table-block__btn';
        addRowBtn.type = 'button';
        addRowBtn.title = '행 추가';
        addRowBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 행';
        addRowBtn.addEventListener('click', () => {
          const cols = this.data.content[0]?.length || 3;
          this.data.content.push(Array(cols).fill(''));
          this._rebuildTable(wrapper);
          Workspace.markDirty();
        });

        const addColBtn = document.createElement('button');
        addColBtn.className = 'table-block__btn';
        addColBtn.type = 'button';
        addColBtn.title = '열 추가';
        addColBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 열';
        addColBtn.addEventListener('click', () => {
          this.data.content.forEach(row => row.push(''));
          this._rebuildTable(wrapper);
          Workspace.markDirty();
        });

        const delRowBtn = document.createElement('button');
        delRowBtn.className = 'table-block__btn table-block__btn--danger';
        delRowBtn.type = 'button';
        delRowBtn.title = '마지막 행 삭제';
        delRowBtn.innerHTML = '− 행';
        delRowBtn.addEventListener('click', () => {
          if (this.data.content.length > 1) {
            this.data.content.pop();
            this._rebuildTable(wrapper);
            Workspace.markDirty();
          }
        });

        const delColBtn = document.createElement('button');
        delColBtn.className = 'table-block__btn table-block__btn--danger';
        delColBtn.type = 'button';
        delColBtn.title = '마지막 열 삭제';
        delColBtn.innerHTML = '− 열';
        delColBtn.addEventListener('click', () => {
          if ((this.data.content[0]?.length || 0) > 1) {
            this.data.content.forEach(row => row.pop());
            this._rebuildTable(wrapper);
            Workspace.markDirty();
          }
        });

        toolbar.appendChild(headingToggle);
        toolbar.appendChild(addRowBtn);
        toolbar.appendChild(addColBtn);
        toolbar.appendChild(delRowBtn);
        toolbar.appendChild(delColBtn);
        wrapper.appendChild(toolbar);
      }

      // 표 본체
      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-block__scroll';
      const table = document.createElement('table');
      table.className = 'table-block__table';

      this.data.content.forEach((rowData, rIdx) => {
        const tr = document.createElement('tr');

        rowData.forEach((cellRaw, cIdx) => {
          const isHeader = this.data.withHeadings && rIdx === 0;
          const cell = document.createElement(isHeader ? 'th' : 'td');
          cell.className = 'table-block__cell';

          const displayVal = this._evalDisplay(cellRaw);
          const isFormula  = typeof cellRaw === 'string' && cellRaw.startsWith('=');

          if (this.readOnly) {
            cell.textContent = displayVal;
          } else {
            cell.contentEditable = 'true';
            cell.textContent = displayVal;
            if (isFormula) cell.setAttribute('data-formula', cellRaw);
            cell.setAttribute('data-row', rIdx);
            cell.setAttribute('data-col', cIdx);

            // 포커스 시 수식 원문 보여주기
            cell.addEventListener('focus', () => {
              const formula = cell.getAttribute('data-formula');
              if (formula) cell.textContent = formula;
            });

            // 블러 시 수식 평가 결과 표시 + data 업데이트
            cell.addEventListener('blur', () => {
              const raw = cell.textContent.trim();
              this.data.content[rIdx][cIdx] = raw;
              if (raw.startsWith('=')) {
                cell.setAttribute('data-formula', raw);
                cell.textContent = this._evalDisplay(raw);
              } else {
                cell.removeAttribute('data-formula');
              }
              // 다른 수식 셀 재계산
              this._recalcFormulas(wrapper);
              Workspace.markDirty();
            });

            // Tab: 다음 셀로 이동
            cell.addEventListener('keydown', (e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const cells = wrapper.querySelectorAll('.table-block__cell[contenteditable]');
                const arr   = Array.from(cells);
                const idx   = arr.indexOf(cell);
                const next  = arr[e.shiftKey ? idx - 1 : idx + 1];
                if (next) next.focus();
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const cells = wrapper.querySelectorAll(`.table-block__cell[data-col="${cIdx}"][contenteditable]`);
                const arr   = Array.from(cells);
                const idx   = arr.indexOf(cell);
                const next  = arr[idx + 1];
                if (next) next.focus();
              }
            });
          }

          tr.appendChild(cell);
        });

        // 행 삭제 버튼 (읽기 전용 제외, 행이 2개 이상)
        if (!this.readOnly && this.data.content.length > 1) {
          const tdDel = document.createElement('td');
          tdDel.className = 'table-block__row-del';
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'table-block__row-del-btn';
          delBtn.title = '이 행 삭제';
          delBtn.innerHTML = '×';
          delBtn.addEventListener('click', () => {
            this.data.content.splice(rIdx, 1);
            this._rebuildTable(wrapper);
            Workspace.markDirty();
          });
          tdDel.appendChild(delBtn);
          tr.appendChild(tdDel);
        }

        table.appendChild(tr);
      });

      // 수식 힌트 행
      if (!this.readOnly) {
        const hint = document.createElement('div');
        hint.className = 'table-block__hint';
        hint.textContent = '수식: =SUM(A1:B3)  =AVERAGE(A1:A5)  =MAX(B1:B4)  =MIN(C1:C3)  =COUNT(A1:C1)';
        tableWrap.appendChild(table);
        wrapper.appendChild(tableWrap);
        wrapper.appendChild(hint);
      } else {
        tableWrap.appendChild(table);
        wrapper.appendChild(tableWrap);
      }
    }

    _recalcFormulas(wrapper) {
      wrapper.querySelectorAll('.table-block__cell[data-formula]').forEach(cell => {
        const formula = cell.getAttribute('data-formula');
        if (document.activeElement !== cell) {
          cell.textContent = this._evalDisplay(formula);
        }
      });
    }

    save(blockContent) {
      const rows = [];
      blockContent.querySelectorAll('tr').forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('th.table-block__cell, td.table-block__cell').forEach(cell => {
          const formula = cell.getAttribute('data-formula');
          rowData.push(formula || cell.textContent);
        });
        if (rowData.length) rows.push(rowData);
      });
      return {
        withHeadings: this.data.withHeadings,
        content:      rows.length ? rows : this.data.content,
      };
    }

    static validate(savedData) { return true; }
  }

  /* =========================================================
     Editor.js 초기화
  ========================================================= */
  function init(pageData) {
    _currentPageId = pageData.id;
    _installEditorChromeGuard();

    // 기존 에디터 파괴 (비동기 완료 보장)
    if (_editor) {
      try { _editor.destroy(); } catch {}
      _editor = null;
    }

    const holder = document.getElementById('editorjs');
    holder.innerHTML = '';
    _clearDropTargetChrome(holder);

    _editor = new EditorJS({
      holder: 'editorjs',
      placeholder: '여기에 내용을 작성하세요. "/" 를 입력하면 블록 종류를 선택할 수 있습니다.',
      data: pageData.editorData && pageData.editorData.blocks
        ? pageData.editorData
        : { blocks: [] },
      readOnly: false,
      autofocus: false,

      tools: {
        // [버그수정] paragraph를 명시적으로 등록하지 않음 (EditorJS 기본 블록)
        header: {
          class: Header,
          config: { levels: [1, 2, 3], defaultLevel: 2 },
          inlineToolbar: ['bold', 'italic', 'underline', 'link'],
        },
        checklist: {
          class: Checklist,
          inlineToolbar: ['bold', 'italic'],
        },
        quote: {
          class: Quote,
          inlineToolbar: true,
          config: { quotePlaceholder: '인용구 입력...', captionPlaceholder: '출처' },
        },
        delimiter: {
          class: Delimiter,
        },
        inlineCode: {
          class: InlineCode,
        },
        underline: {
          class: Underline,
        },
        toggle: {
          class: ToggleTool,
        },
        image: {
          class: DarakImageTool,
        },
        pageLink: {
          class: PageLinkTool,
        },
        callout: {
          class: CalloutTool,
        },
        table: {
          class: TableTool,
        },
      },

      i18n: {
        messages: {
          ui: {
            blockTunes: {
              toggler: {
                'Click to tune': '설정',
                'or drag to move': '또는 드래그로 이동',
              },
            },
            inlineToolbar: {
              converter: { 'Convert to': '변환' },
            },
            toolbar: {
              toolbox: { 'Add': '추가', 'Filter': '검색', 'Nothing found': '없음' },
            },
            popover: {
              'Filter': '검색',
              'Nothing found': '없음',
              'Convert to': '변환',
            },
          },
          toolNames: {
            'Text': '텍스트',
            'Heading': '제목',
            'Checklist': '체크리스트',
            'Quote': '인용구',
            'Delimiter': '구분선',
            'Bold': '굵게',
            'Italic': '기울임',
            'Underline': '밑줄',
            'Link': '링크',
            'InlineCode': '인라인 코드',
          },
          blockTunes: {
            delete: { 'Delete': '삭제', 'Click to delete': '삭제하려면 클릭' },
            moveUp: { 'Move up': '위로' },
            moveDown: { 'Move down': '아래로' },
          },
        },
      },

      onChange: () => {
        Workspace.markDirty();
      },

      onReady: () => {
        // 슬래시 명령어 초기화
        _initSlashCommand();
      },
    });

    return _editor;
  }

  /* =========================================================
     Editor.js 기본 드롭 가이드 제거
  ========================================================= */
  function _installEditorChromeGuard() {
    if (!document.getElementById('darakbang-editor-chrome-guard')) {
      const style = document.createElement('style');
      style.id = 'darakbang-editor-chrome-guard';
      style.textContent = `
        .codex-editor .ce-block--drop-target .ce-block__content::before,
        .codex-editor .ce-block--drop-target .ce-block__content::after,
        .codex-editor .ce-block__content::before,
        .codex-editor .ce-block__content::after,
        .codex-editor .ce-toolbar__content::before,
        .codex-editor .ce-toolbar__content::after,
        .codex-editor .ce-toolbar__actions::before,
        .codex-editor .ce-toolbar__actions::after,
        .codex-editor [data-placeholder-active]:empty:focus::before,
        .codex-editor [data-placeholder-active][data-empty="true"]:focus::before,
        .codex-editor [data-placeholder]:empty:focus::before,
        .codex-editor [data-placeholder][data-empty="true"]:focus::before,
        .codex-editor__redactor [contenteditable]:empty::after,
        .ce-paragraph:empty::after,
        .codex-editor-overlay__rectangle {
          display: none !important;
          content: none !important;
          width: 0 !important;
          height: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          background: transparent !important;
          background-image: none !important;
        }

        .codex-editor .ce-block,
        .codex-editor .ce-block__content {
          border: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          background-image: none !important;
        }

        .codex-editor .ce-popover:not(.ce-popover--opened),
        .codex-editor .ce-settings:not(.ce-settings--opened),
        .codex-editor .ce-inline-toolbar:not(.ce-inline-toolbar--showed) {
          width: 0 !important;
          height: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          background: transparent !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(style);
    }

    const holder = document.getElementById('editorjs');
    if (!holder || _chromeGuardObserver) return;

    _chromeGuardObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
        const target = mutation.target;
        if (target instanceof Element && target.classList.contains('ce-block--drop-target')) {
          target.classList.remove('ce-block--drop-target');
        }
      }
    });

    _chromeGuardObserver.observe(holder, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function _clearDropTargetChrome(root = document) {
    root.querySelectorAll?.('.ce-block--drop-target').forEach((el) => {
      el.classList.remove('ce-block--drop-target');
    });
  }

  /* =========================================================
     슬래시 명령어
  ========================================================= */
  const SLASH_COMMANDS = [
    { name: '텍스트',     desc: '일반 문단 텍스트',    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>', type: 'paragraph' },
    { name: '제목 1',     desc: '가장 큰 제목',        icon: 'H1', type: 'header',    data: { level: 1 } },
    { name: '제목 2',     desc: '중간 제목',           icon: 'H2', type: 'header',    data: { level: 2 } },
    { name: '제목 3',     desc: '작은 제목',           icon: 'H3', type: 'header',    data: { level: 3 } },
    { name: '체크리스트', desc: '완료 체크박스 목록',   icon: '☑️', type: 'checklist' },
    { name: '인용구',     desc: '텍스트 인용 블록',    icon: '"',  type: 'quote'     },
    { name: '구분선',     desc: '수평 구분선',         icon: '—',  type: 'delimiter' },
    { name: '토글',       desc: '접기/펼치기 블록',    icon: '▶',  type: 'toggle'    },
    { name: '이미지',     desc: '이미지 첨부/붙여넣기', icon: '🖼️', type: 'image'    },
    { name: '하위 문서',  desc: '현재 페이지 아래 새 문서', icon: '📄', type: 'pageLink'  },
    { name: '콜아웃',     desc: '강조 박스 (7색)',     icon: '💬', type: 'callout'   },
    { name: '표',         desc: '행·열 표 (수식 지원)', icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="1" y1="11" x2="15" y2="11"/><line x1="6" y1="1" x2="6" y2="15"/><line x1="11" y1="1" x2="11" y2="15"/></svg>', type: 'table' },
  ];

  // 슬래시 상태 변수 (함수 스코프로 분리)
  let _slashQuery = '';
  let _slashTextNode = null;
  let _slashIdx = 0;

  // 이벤트 리스너 정리용
  let _slashKeydownHandler = null;
  let _slashInputHandler   = null;
  let _slashClickHandler   = null;

  function _initSlashCommand() {
    const holder = document.getElementById('editorjs');
    if (!holder) return;

    // 기존 리스너 정리
    if (_slashKeydownHandler) holder.removeEventListener('keydown', _slashKeydownHandler, true);
    if (_slashInputHandler)   holder.removeEventListener('input',   _slashInputHandler);
    if (_slashClickHandler)   document.removeEventListener('click',  _slashClickHandler);

    _slashKeydownHandler = (e) => {
      if (!_slashPopupOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); _closeSlashPopup(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); _moveSlashSelection(1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); _moveSlashSelection(-1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = document.querySelector('.slash-popup-item.selected');
        if (selected) selected.click();
        return;
      }
    };

    _slashInputHandler = () => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;

      const textNode = sel.anchorNode;
      const text = textNode.textContent || '';
      const caretPos = sel.anchorOffset;
      const beforeCaret = text.slice(0, caretPos);
      const slashIdx = beforeCaret.lastIndexOf('/');

      if (slashIdx !== -1) {
        const charBefore = beforeCaret[slashIdx - 1];
        const isAtStart = slashIdx === 0;
        const isPrecededBySpace = charBefore === ' ' || charBefore === '\n' || charBefore === undefined;

        if (isAtStart || isPrecededBySpace) {
          const query = beforeCaret.slice(slashIdx + 1);
          if (!query.includes(' ') && query.length <= 10) {
            _openSlashPopup(query, textNode, slashIdx);
            return;
          }
        }
      }

      if (_slashPopupOpen) _closeSlashPopup();
    };

    _slashClickHandler = (e) => {
      if (_slashPopupOpen && !e.target.closest('#slash-popup')) {
        _closeSlashPopup();
      }
    };

    holder.addEventListener('keydown', _slashKeydownHandler, true);
    holder.addEventListener('input',   _slashInputHandler);
    document.addEventListener('click', _slashClickHandler);
  }

  function _openSlashPopup(query, textNode, idx) {
    _slashQuery    = query;
    _slashTextNode = textNode;
    _slashIdx      = idx;
    _slashPopupOpen = true;

    const popup = document.getElementById('slash-popup');
    const list  = document.getElementById('slash-popup-list');

    const filtered = query
      ? SLASH_COMMANDS.filter(c => c.name.includes(query) || c.desc.includes(query))
      : SLASH_COMMANDS;

    list.innerHTML = '';
    filtered.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.className = `slash-popup-item${i === 0 ? ' selected' : ''}`;
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <span class="slash-popup-item-icon">${cmd.icon}</span>
        <div class="slash-popup-item-info">
          <div class="slash-popup-item-name">${cmd.name}</div>
          <div class="slash-popup-item-desc">${cmd.desc}</div>
        </div>
      `;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _insertBlock(cmd);
        _closeSlashPopup();
      });
      list.appendChild(li);
    });

    if (!filtered.length) {
      list.innerHTML = '<li class="slash-popup-item" style="color:var(--text-muted);padding:12px 16px;">일치하는 블록 없음</li>';
    }

    // 팝업 위치 (캐럿 기준)
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const popupW = 340;
      let left = rect.left;
      let top  = rect.bottom + 8;
      if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
      popup.classList.remove('hidden');

      const popupH = popup.offsetHeight || 420;
      if (top + popupH > window.innerHeight - 8) top = rect.top - popupH - 8;
      popup.style.left = `${Math.max(8, left)}px`;
      popup.style.top  = `${Math.max(8, top)}px`;
    } else {
      popup.classList.remove('hidden');
    }
  }

  function _closeSlashPopup() {
    document.getElementById('slash-popup')?.classList.add('hidden');
    _slashPopupOpen = false;
    _slashQuery    = '';
    _slashTextNode = null;
    _slashIdx      = 0;
  }

  function _moveSlashSelection(dir) {
    const items = Array.from(document.querySelectorAll('.slash-popup-item'));
    if (!items.length) return;
    const current = document.querySelector('.slash-popup-item.selected');
    let idx = items.indexOf(current);
    idx = (idx + dir + items.length) % items.length;
    items.forEach(i => i.classList.remove('selected'));
    items[idx].classList.add('selected');
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  async function _insertBlock(cmd) {
    if (!_editor) return;

    // 슬래시 텍스트 제거
    if (_slashTextNode) {
      try {
        const fullText = _slashTextNode.textContent;
        const before   = fullText.slice(0, _slashIdx);
        const after    = fullText.slice(_slashIdx + 1 + _slashQuery.length);
        _slashTextNode.textContent = before + after;
      } catch (e) {
        console.warn('슬래시 텍스트 제거 실패:', e);
      }
    }

    try {
      // [버그수정] paragraph 타입은 EditorJS 기본 타입명 그대로 사용
      const blockType = cmd.type; // 'paragraph', 'header', 'checklist', etc.
      const currentIndex = await _editor.blocks.getCurrentBlockIndex();
      await _editor.blocks.insert(blockType, cmd.data || {}, {}, currentIndex + 1, true);
    } catch (e) {
      console.error('블록 삽입 실패:', e);
      UI.toast(`블록 삽입 실패: ${e.message}`, 'error');
    }
  }

  /* =========================================================
     커버 이미지 로드
  ========================================================= */
  async function loadCoverImage(fileId) {
    if (!fileId) return null;
    if (!_blobUrlCache[fileId]) {
      _blobUrlCache[fileId] = await Drive.getImageBlobUrl(fileId);
    }
    return _blobUrlCache[fileId];
  }

  /* =========================================================
     에디터 데이터 추출
  ========================================================= */
  async function getEditorData() {
    if (!_editor) return { blocks: [] };
    try {
      await _editor.isReady;
      return await _editor.save();
    } catch (e) {
      console.error('에디터 데이터 저장 실패:', e);
      return { blocks: [] };
    }
  }

  /* =========================================================
     에디터 파괴
  ========================================================= */
  function destroy() {
    if (_editor) {
      try { _editor.destroy(); } catch {}
      _editor = null;
    }
    _closeSlashPopup();

    // 이벤트 리스너 정리
    const holder = document.getElementById('editorjs');
    if (holder) {
      if (_slashKeydownHandler) holder.removeEventListener('keydown', _slashKeydownHandler, true);
      if (_slashInputHandler)   holder.removeEventListener('input',   _slashInputHandler);
    }
    if (_slashClickHandler) document.removeEventListener('click', _slashClickHandler);
    _slashKeydownHandler = null;
    _slashInputHandler   = null;
    _slashClickHandler   = null;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    init,
    getEditorData,
    loadCoverImage,
    destroy,
    get instance() { return _editor; },
  };
})();
