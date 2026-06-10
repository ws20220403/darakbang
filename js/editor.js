/**
 * editor.js — Editor.js 통합 (v2)
 *
 * 변경점
 *  - 신규 블록: 목록(NestedList)·코드(CodeTool)·표(Table)·북마크·목차(TOC)
 *  - v1 의 "크롬 가드"(!important CSS 전쟁 + MutationObserver) 전면 제거
 *  - 커스텀 드래그&드롭: 설정 손잡이(⠿)를 잡고 끌어 블록 재배치 + 드롭 인디케이터
 *    · 위로/아래로(블록 튠)는 접근성·키보드용으로 유지
 *    · 포인터 이벤트 기반이라 마우스/터치(모바일) 모두 동작
 *  - 이미지: Storage(드라이브/데모) 사용 + Blob URL revoke 로 누수 방지
 *  - 추가 메뉴(+, "/")는 네이티브 팝오버를 그리드·무스크롤로 재스타일링(css)
 */

const EditorManager = (() => {

  let _editor = null;
  let _currentPageId = null;
  let _blobUrlCache = {};        // fileId → objectURL(드라이브) | dataURL(데모)
  let _changeDebounce = null;

  /* =========================================================
     되돌리기/복원 히스토리 (스냅샷 기반, HWP식 '묶음' 단위)
     - 입력이 잠시 멈추면(약 0.6초) 한 덩어리로 스냅샷을 커밋 → Ctrl+Z 한 번에 한 묶음 되돌림
  ========================================================= */
  const HISTORY_MAX = 100;
  let _undo = [];
  let _redo = [];
  let _curState = null;      // 현재 커밋된 상태(스냅샷)
  let _restoring = false;    // 되돌리기/복원 중(스냅샷 생성 방지)
  let _snapTimer = null;
  let _pending = false;      // 마지막 커밋 이후 바뀐 내용이 있는지(되돌리기 버튼 활성에 사용)
  let _onHistory = null;     // 상태 변화 콜백(버튼 갱신용)

  function setHistoryListener(fn) { _onHistory = fn; }
  function _notifyHistory() { if (_onHistory) try { _onHistory(); } catch {} }
  function canUndo() { return _undo.length > 0 || _pending; }
  function canRedo() { return _redo.length > 0; }

  function _sig(data) {
    // id/time 제외하고 type+data 만으로 동등성 비교(불필요한 스냅샷 방지)
    const blocks = (data && Array.isArray(data.blocks)) ? data.blocks : [];
    return JSON.stringify(blocks.map(b => ({ t: b.type, d: b.data })));
  }
  function _clone(data) { return { blocks: JSON.parse(JSON.stringify((data && data.blocks) || [])) }; }

  function _resetHistory(initialData) {
    _undo = []; _redo = [];
    _curState = _clone(initialData);
    _pending = false;
    clearTimeout(_snapTimer);
    _notifyHistory();
  }

  function _scheduleSnapshot() {
    if (_restoring) return;
    _pending = true;
    _notifyHistory();                 // 입력 시작 → 되돌리기 버튼 활성
    clearTimeout(_snapTimer);
    _snapTimer = setTimeout(() => { _commitSnapshot(); }, 600);
  }

  // 알려진 상태를 히스토리에 확정(동기). 직전 상태와 다르면 _undo 에 쌓는다.
  function _pushState(state) {
    if (!state) return false;
    if (_sig(state) === _sig(_curState)) { _pending = false; _notifyHistory(); return false; }
    _undo.push(_curState);
    if (_undo.length > HISTORY_MAX) _undo.shift();
    _curState = _clone(state);
    _redo = [];
    _pending = false;
    _notifyHistory();
    return true;
  }

  async function _commitSnapshot() {
    if (_restoring) return false;
    const live = await getEditorData();
    return _pushState(live);
  }

  // blocks.render 의 프로미스가 일부 커스텀 블록(토글 등)에서 resolve 안 되는 Editor.js 이슈 →
  // 타임아웃과 경쟁시켜 멈추지 않게 한다(렌더 자체는 DOM 에 즉시 반영됨).
  async function _renderBlocks(arr) {
    if (!_editor) return;
    try {
      await Promise.race([
        Promise.resolve(_editor.blocks.render({ blocks: arr })),
        new Promise(r => setTimeout(r, 400)),
      ]);
    } catch (e) { console.warn('blocks.render:', e); }
  }

  async function _restore(state) {
    if (!_editor) return;
    _restoring = true;
    clearTimeout(_snapTimer);
    try {
      await _editor.isReady;
      await _renderBlocks(JSON.parse(JSON.stringify(state.blocks)));
      Workspace.markDirty();
      _setupCodeAutosize();
    } catch (e) { console.warn('히스토리 복원 실패:', e); }
    // 복원으로 생긴 onChange(렌더 변화)가 새 스냅샷을 만들지 않도록 잠깐 유지
    setTimeout(() => { _restoring = false; }, 350);
    _notifyHistory();
  }

  async function undo() {
    clearTimeout(_snapTimer);
    if (_pending) await _commitSnapshot();   // 입력 중이던 마지막 묶음을 먼저 확정
    if (!_undo.length) { _notifyHistory(); return; }
    _redo.push(_curState);
    _curState = _undo.pop();
    await _restore(_curState);
  }

  async function redo() {
    if (!_redo.length) return;
    _undo.push(_curState);
    _curState = _redo.pop();
    await _restore(_curState);
  }

  /* =========================================================
     초기화
  ========================================================= */
  function init(pageData) {
    _currentPageId = pageData.id;

    // 이전 에디터 정리
    if (_editor) {
      _teardownDrag();
      try { _editor.destroy(); } catch {}
      _editor = null;
    }
    _revokeBlobs();

    const holder = document.getElementById('editorjs');
    holder.innerHTML = '';

    const data = _migrate((pageData.editorData && pageData.editorData.blocks) ? pageData.editorData : { blocks: [] });

    _editor = new EditorJS({
      holder: 'editorjs',
      placeholder: '여기에 내용을 작성하세요. "/" 를 입력하면 블록을 추가할 수 있어요.',
      data,
      autofocus: false,
      tools: _tools(),
      i18n: _i18n(),
      onChange: () => {
        if (!_restoring) Workspace.markDirty();
        _scheduleSnapshot();                 // 되돌리기 히스토리(묶음 스냅샷)
        clearTimeout(_changeDebounce);
        _changeDebounce = setTimeout(() => {
          document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
        }, 400);
      },
      onReady: () => {
        _setupDrag();
        _setupCodeAutosize();
        _setupAutoReplace();
        _setupConvertButton();
      },
    });

    // 새 페이지 로드 → 히스토리 초기화(이전 페이지 기록과 섞이지 않게)
    _resetHistory(data);

    return _editor;
  }

  /* 옛 'spreadsheet' 블록을 통합 'table' 블록으로 변환 (하위호환) */
  function _migrate(editorData) {
    if (!editorData || !Array.isArray(editorData.blocks)) return editorData;
    editorData.blocks = editorData.blocks.map(b => {
      if (b && b.type === 'spreadsheet') {
        const cells = (b.data && Array.isArray(b.data.cells)) ? b.data.cells : [];
        return { ...b, type: 'table', data: { withHeadings: false, content: cells } };
      }
      return b;
    });
    return editorData;
  }

  /* =========================================================
     도구 등록
  ========================================================= */
  function _tools() {
    return {
      // paragraph 는 EditorJS 기본 블록 (등록 불필요)
      header: {
        class: Header,
        config: { levels: [1, 2, 3], defaultLevel: 2 },
        inlineToolbar: ['bold', 'italic', 'underline', 'inlineCode', 'link'],
      },
      list: {
        class: NestedList,
        inlineToolbar: true,
        config: { defaultStyle: 'unordered' },
      },
      checklist: {
        class: Checklist,
        inlineToolbar: ['bold', 'italic', 'inlineCode', 'link'],
      },
      code: {
        class: CodeTool,
        config: { placeholder: '코드를 입력하세요...' },
      },
      // [v3] 표 + 계산표 통합 (TableTool, blocks.js) — 기존 @editorjs/table 대체
      table: {
        class: TableTool,
      },
      quote: {
        class: Quote,
        inlineToolbar: true,
        config: { quotePlaceholder: '인용구 입력...', captionPlaceholder: '출처' },
      },
      delimiter: { class: Delimiter },
      inlineCode: { class: InlineCode },
      underline: { class: Underline },

      // 커스텀 블록 (blocks.js)
      toggle:      { class: ToggleTool },
      callout:     { class: CalloutTool },
      image:       { class: DarakImageTool },
      attachment:  { class: AttachmentTool },    // [v3] 파일 첨부 (PDF/Word/Excel/hwp…)
      bookmark:    { class: BookmarkTool },
      pageLink:    { class: PageLinkTool },
      toc:         { class: TableOfContentsTool },
    };
  }

  /* =========================================================
     i18n (한국어)
  ========================================================= */
  function _i18n() {
    return {
      messages: {
        ui: {
          blockTunes: {
            toggler: { 'Click to tune': '설정', 'or drag to move': '또는 드래그로 이동' },
          },
          inlineToolbar: { converter: { 'Convert to': '변환' } },
          toolbar: { toolbox: { 'Add': '추가', 'Filter': '블록 검색', 'Nothing found': '결과 없음' } },
          popover: { 'Filter': '블록 검색', 'Nothing found': '결과 없음', 'Convert to': '변환' },
        },
        toolNames: {
          'Text': '텍스트',
          'Heading': '제목',
          'List': '목록',
          'Checklist': '체크리스트',
          'Code': '코드',
          'Table': '표',
          'Quote': '인용구',
          'Delimiter': '구분선',
          'Bold': '굵게',
          'Italic': '기울임',
          'Underline': '밑줄',
          'Link': '링크',
          'InlineCode': '인라인 코드',
        },
        tools: {
          list: { 'Unordered': '글머리 기호', 'Ordered': '번호 목록' },
          table: {
            'Add column to left': '왼쪽에 열 추가', 'Add column to right': '오른쪽에 열 추가',
            'Delete column': '열 삭제', 'Add row above': '위에 행 추가',
            'Add row below': '아래에 행 추가', 'Delete row': '행 삭제',
            'With headings': '헤더 사용', 'Without headings': '헤더 없음',
          },
          link: { 'Add a link': '링크 입력' },
        },
        blockTunes: {
          delete:   { 'Delete': '삭제', 'Click to delete': '삭제하려면 클릭' },
          moveUp:   { 'Move up': '위로' },
          moveDown: { 'Move down': '아래로' },
        },
      },
    };
  }

  /* =========================================================
     드래그 & 드롭 (커스텀)
     - 설정 손잡이(.ce-toolbar__settings-btn)를 잡고 끌면 블록 이동
     - 임계값(6px) 넘기 전엔 일반 클릭(튠 메뉴 열기)으로 동작
  ========================================================= */
  let _drag = null;            // 진행 중 드래그 상태
  let _hoverIndex = -1;        // 마지막으로 가리킨 블록 인덱스
  let _indicator = null;       // 드롭 위치 라인
  let _ghost = null;           // 따라다니는 라벨

  function _redactor() {
    return document.querySelector('#editorjs .codex-editor__redactor');
  }
  function _blockEls() {
    const r = _redactor();
    return r ? Array.from(r.querySelectorAll(':scope > .ce-block')) : [];
  }

  function _setupDrag() {
    const holder = document.getElementById('editorjs');
    if (!holder) return;
    holder.addEventListener('pointermove', _onHoverMove);
    holder.addEventListener('pointerdown', _onHandleDown, true);
  }

  function _teardownDrag() {
    const holder = document.getElementById('editorjs');
    if (holder) {
      holder.removeEventListener('pointermove', _onHoverMove);
      holder.removeEventListener('pointerdown', _onHandleDown, true);
      holder.removeEventListener('input', _onCodeInput, true);
    }
    _cancelDrag();
  }

  function _onHoverMove(e) {
    if (!_convertBtnInjected) _ensureConvertBtn();   // 툴바가 호버 때 생기므로 이때 버튼 주입
    const blockEl = e.target.closest?.('.ce-block');
    if (!blockEl) return;
    const idx = _blockEls().indexOf(blockEl);
    if (idx !== -1) _hoverIndex = idx;
  }

  function _onHandleDown(e) {
    const handle = e.target.closest?.('.ce-toolbar__settings-btn');
    if (!handle) return;
    if (e.button !== undefined && e.button !== 0) return;

    const sourceIndex = _hoverIndex;
    if (sourceIndex < 0) return;

    _drag = {
      handle, sourceIndex, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      active: false, targetGap: null,
    };
    document.addEventListener('pointermove', _onDragMove, true);
    document.addEventListener('pointerup', _onDragUp, true);
    document.addEventListener('pointercancel', _onDragUp, true);
  }

  function _onDragMove(e) {
    if (!_drag) return;
    const dx = e.clientX - _drag.startX;
    const dy = e.clientY - _drag.startY;

    if (!_drag.active) {
      if (Math.hypot(dx, dy) < 6) return;   // 임계값 미만 → 아직 클릭
      _startDrag(e);
    }

    e.preventDefault();
    _moveGhost(e.clientX, e.clientY);
    _drag.targetGap = _computeGap(e.clientY);
    _positionIndicator(_drag.targetGap);
  }

  function _startDrag(e) {
    _drag.active = true;
    try { _drag.handle.setPointerCapture?.(e.pointerId); } catch {}
    document.body.classList.add('is-block-dragging');

    const srcEl = _blockEls()[_drag.sourceIndex];
    if (srcEl) srcEl.classList.add('ce-block--being-dragged');

    // 드롭 인디케이터
    _indicator = document.createElement('div');
    _indicator.className = 'block-drop-indicator';
    _redactor()?.appendChild(_indicator);

    // 고스트 라벨
    _ghost = document.createElement('div');
    _ghost.className = 'block-drag-ghost';
    const label = (srcEl?.textContent || '블록').trim().slice(0, 24) || '블록';
    _ghost.textContent = '⠿ ' + label;
    document.body.appendChild(_ghost);
  }

  function _moveGhost(x, y) {
    if (_ghost) { _ghost.style.left = `${x + 12}px`; _ghost.style.top = `${y + 12}px`; }
  }

  // 커서 Y로 삽입 위치(gap) 계산: 0..n
  function _computeGap(y) {
    const els = _blockEls();
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return els.length;
  }

  function _positionIndicator(gap) {
    if (!_indicator) return;
    const els = _blockEls();
    if (!els.length) return;
    const r = _redactor().getBoundingClientRect();
    let top;
    if (gap >= els.length) {
      const last = els[els.length - 1].getBoundingClientRect();
      top = last.bottom - r.top;
    } else {
      const target = els[gap].getBoundingClientRect();
      top = target.top - r.top;
    }
    _indicator.style.top = `${top}px`;
  }

  function _onDragUp(e) {
    if (!_drag) return;
    const wasActive = _drag.active;
    const source = _drag.sourceIndex;
    const gap = _drag.targetGap;

    _cleanupDragVisuals();
    document.removeEventListener('pointermove', _onDragMove, true);
    document.removeEventListener('pointerup', _onDragUp, true);
    document.removeEventListener('pointercancel', _onDragUp, true);
    _drag = null;

    if (!wasActive) return;     // 단순 클릭 → 튠 메뉴는 그대로 동작
    e.preventDefault();
    e.stopPropagation();

    if (gap == null) return;
    let target = gap;
    if (source < gap) target -= 1;          // 제거 후 인덱스 보정
    const count = _blockEls().length;
    target = Math.max(0, Math.min(target, count - 1));
    if (target !== source) {
      try {
        _editor.blocks.move(target, source);
        Workspace.markDirty();
        document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
      } catch (err) { console.warn('블록 이동 실패:', err); }
    }
  }

  function _cleanupDragVisuals() {
    document.body.classList.remove('is-block-dragging');
    _blockEls().forEach(el => el.classList.remove('ce-block--being-dragged'));
    _indicator?.remove(); _indicator = null;
    _ghost?.remove(); _ghost = null;
  }

  function _cancelDrag() {
    if (!_drag) return;
    _cleanupDragVisuals();
    document.removeEventListener('pointermove', _onDragMove, true);
    document.removeEventListener('pointerup', _onDragUp, true);
    document.removeEventListener('pointercancel', _onDragUp, true);
    _drag = null;
  }

  /* =========================================================
     코드 블록 자동 높이 (내용이 잘리지 않도록 textarea를 늘림)
  ========================================================= */
  function _fitCode(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
  function _autosizeAllCode() {
    document.querySelectorAll('#editorjs .ce-code__textarea').forEach(_fitCode);
  }
  function _onCodeInput(e) {
    const t = e.target;
    if (t && t.classList && t.classList.contains('ce-code__textarea')) _fitCode(t);
  }
  function _setupCodeAutosize() {
    const holder = document.getElementById('editorjs');
    if (!holder) return;
    holder.removeEventListener('input', _onCodeInput, true);
    holder.addEventListener('input', _onCodeInput, true);
    // 최초 로드 직후 + 폰트 로드 후 한 번 더 맞춤
    setTimeout(_autosizeAllCode, 60);
    setTimeout(_autosizeAllCode, 350);
  }

  /* =========================================================
     간편 자동변환 (입력 중 -> 를 → 로 등). 코드/표 셀은 제외.
  ========================================================= */
  // [입력으로 끝나는 패턴, 치환] — 긴 패턴을 먼저 검사
  const _AUTO = [
    ['-->', '→'], ['->', '→'],
    ['<--', '←'], ['<-', '←'],
    ['=>', '⇒'],
    ['...', '…'],
    ['(c)', '©'], ['(C)', '©'], ['(r)', '®'], ['(R)', '®'], ['(tm)', '™'], ['(TM)', '™'],
  ];
  function _onAutoReplaceInput(e) {
    const t = e.target;
    if (!t || (t.closest && (t.closest('.ce-code') || t.closest('.table-block') || t.closest('.bookmark-block__input')))) return; // 코드/표/URL 제외
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== 3) return;                 // 텍스트 노드만
    const offset = range.startOffset;
    const before = node.textContent.slice(0, offset);
    for (const [pat, rep] of _AUTO) {
      if (before.endsWith(pat)) {
        const start = offset - pat.length;
        node.textContent = node.textContent.slice(0, start) + rep + node.textContent.slice(offset);
        const newOffset = start + rep.length;
        const r = document.createRange();
        const safe = Math.min(newOffset, node.textContent.length);
        r.setStart(node, safe); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        return;
      }
    }
  }
  function _setupAutoReplace() {
    const holder = document.getElementById('editorjs');
    if (!holder) return;
    holder.removeEventListener('input', _onAutoReplaceInput, true);
    holder.addEventListener('input', _onAutoReplaceInput, true);
  }

  /* =========================================================
     전환(Convert) — 여러 블록의 양식을 한 번에 바꾸기
     - 추가(+)·설정(⠿) 옆에 '전환' 버튼. 범위로 여러 블록을 잡으면 일괄 전환.
     - 전환 가능 유형만 바뀌고(표·이미지 등은 유지),
       목록/토글 → 텍스트/체크리스트는 항목별로 '분할', 텍스트 → 목록/토글은 '병합/개별 분류'.
  ========================================================= */
  const _TRANSFORMABLE = new Set(['paragraph', 'header', 'list', 'checklist', 'quote', 'code', 'toggle', 'callout']);
  const _CONVERT_TYPES = [
    { type: 'paragraph', label: '텍스트' },
    { type: 'header', level: 1, label: '제목 1' },
    { type: 'header', level: 2, label: '제목 2' },
    { type: 'header', level: 3, label: '제목 3' },
    { type: 'list', style: 'unordered', label: '글머리 목록' },
    { type: 'list', style: 'ordered', label: '번호 목록' },
    { type: 'checklist', label: '체크리스트' },
    { type: 'quote', label: '인용구' },
    { type: 'code', label: '코드' },
    { type: 'toggle', label: '토글' },
    { type: 'callout', label: '콜아웃' },
  ];

  function _esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
  function _stripHtml(html) { const d = document.createElement('div'); d.innerHTML = String(html == null ? '' : html); return d.textContent || ''; }
  function _splitLines(html) {
    const parts = String(html == null ? '' : html).split(/<br\s*\/?>|\r?\n/i).map(s => s.trim());
    const filtered = parts.filter(s => s !== '' && s.toLowerCase() !== '<br>');
    return filtered.length ? filtered : [];
  }

  // 블록 → 항목 배열 [{text(html), checked?}]
  function _blockToItems(b) {
    const d = b.data || {};
    switch (b.type) {
      case 'paragraph': case 'header': case 'quote': case 'callout': {
        const ls = _splitLines(d.text); return ls.length ? ls.map(t => ({ text: t })) : [{ text: '' }];
      }
      case 'code':
        return String(d.code || '').split('\n').map(t => ({ text: _esc(t) }));
      case 'toggle': {
        const items = _splitLines(d.title).map(t => ({ text: t }));
        _splitLines(d.content).forEach(t => items.push({ text: t }));
        return items.length ? items : [{ text: '' }];
      }
      case 'list': {
        const out = [];
        const walk = (arr) => (arr || []).forEach(it => {
          const c = (typeof it === 'string') ? it : (it && it.content);
          out.push({ text: c || '' });
          if (it && it.items && it.items.length) walk(it.items);
        });
        walk(d.items);
        return out.length ? out : [{ text: '' }];
      }
      case 'checklist':
        return (d.items || []).map(it => ({ text: it.text || '', checked: !!it.checked }));
      default: return [{ text: '' }];
    }
  }

  // 항목 배열 + 대상유형 → 새 블록 배열 (분할/병합 규칙 적용)
  function _itemsToBlocks(items, t) {
    items = items.filter(it => !(it.text === '' )); if (!items.length) items = [{ text: '' }];
    switch (t.type) {
      case 'paragraph': return items.map(it => ({ type: 'paragraph', data: { text: it.text } }));
      case 'header':    return items.map(it => ({ type: 'header', data: { text: it.text, level: t.level || 2 } }));
      case 'quote':     return items.map(it => ({ type: 'quote', data: { text: it.text, caption: '', alignment: 'left' } }));
      case 'callout':   return items.map(it => ({ type: 'callout', data: { text: it.text, icon: '💡', color: 'blue' } }));
      case 'toggle':    return items.map(it => ({ type: 'toggle', data: { title: it.text, content: '', isOpen: true } }));
      case 'list':      return [{ type: 'list', data: { style: t.style || 'unordered', items: items.map(it => ({ content: it.text, items: [] })) } }];
      case 'checklist': return [{ type: 'checklist', data: { items: items.map(it => ({ text: it.text, checked: !!it.checked })) } }];
      case 'code':      return [{ type: 'code', data: { code: items.map(it => _stripHtml(it.text)).join('\n') } }];
      default:          return items.map(it => ({ type: 'paragraph', data: { text: it.text } }));
    }
  }

  // 전환 대상 블록 인덱스: 선택된 블록 우선, 없으면 마우스가 올라간 블록
  function _convertTargetIndices() {
    const els = _blockEls();
    const sel = els.map((el, i) => el.classList.contains('ce-block--selected') ? i : -1).filter(i => i >= 0);
    if (sel.length) return sel;
    if (_hoverIndex >= 0 && _hoverIndex < els.length) return [_hoverIndex];
    try { const ci = _editor.blocks.getCurrentBlockIndex(); if (ci >= 0) return [ci]; } catch {}
    return [];
  }

  async function _convert(indices, target) {
    if (!_editor) return;
    const out = await getEditorData();
    if (!out) return;
    const blocks = out.blocks;
    const selSet = new Set(indices.filter(i => blocks[i] && _TRANSFORMABLE.has(blocks[i].type)));
    if (!selSet.size) {
      UI.toast('전환할 수 있는 블록이 없어요. (텍스트·제목·목록·체크리스트·인용구·코드·토글·콜아웃)', 'info', 4500);
      return;
    }
    let items = [];
    [...selSet].sort((a, b) => a - b).forEach(i => { items = items.concat(_blockToItems(blocks[i])); });
    const made = _itemsToBlocks(items, target);

    const newArr = [];
    let inserted = false;
    blocks.forEach((b, i) => {
      if (selSet.has(i)) { if (!inserted) { newArr.push(...made); inserted = true; } }
      else newArr.push(b);
    });
    try {
      _pushState(out);                 // 전환 전 상태를 히스토리에 확정
      await _renderBlocks(newArr);
      Workspace.markDirty();
      _setupCodeAutosize();
      const post = await getEditorData();
      _pushState(post);                // 전환 결과를 새 히스토리 단계로 → 되돌리기 가능
      document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
    } catch (e) { console.warn('전환 실패:', e); UI.toast('전환 중 문제가 발생했어요.', 'error'); }
  }

  /* 전환 버튼을 에디터 툴바(추가·설정 옆)에 주입 + 메뉴.
     Editor.js 툴바는 첫 호버 때 생기므로 onReady 즉시 + 호버 때(플래그 1회) 주입한다. */
  let _convertMenuEl = null;
  let _convertBtnInjected = false;
  function _ensureConvertBtn() {
    const actions = document.querySelector('#editorjs .ce-toolbar__actions');
    if (!actions) return false;
    if (actions.querySelector('.ce-toolbar__convert-btn')) { _convertBtnInjected = true; return true; }
    const btn = document.createElement('div');
    btn.className = 'ce-toolbar__convert-btn';
    btn.setAttribute('role', 'button');
    btn.title = '전환 — 블록 양식 바꾸기 (여러 블록 선택 시 일괄)';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); _openConvertMenu(btn); });
    actions.appendChild(btn);
    _convertBtnInjected = true;
    return true;
  }
  let _convertObserver = null;
  function _setupConvertButton() {
    _convertBtnInjected = false;   // 새 에디터 → 새 툴바. 다시 주입 필요.
    _ensureConvertBtn();            // 이미 툴바가 있으면 즉시
    // 툴바가 (호버 등으로) 나중에 생겨도 확실히 주입 — DOM 변화 감시(주입되면 플래그로 무시되어 가벼움)
    if (!_convertObserver) {
      const holder = document.getElementById('editorjs');
      if (holder) {
        _convertObserver = new MutationObserver(() => { if (!_convertBtnInjected) _ensureConvertBtn(); });
        _convertObserver.observe(holder, { childList: true, subtree: true });
      }
    }
  }

  function _closeConvertMenu() {
    if (_convertMenuEl) { _convertMenuEl.remove(); _convertMenuEl = null; }
    document.removeEventListener('click', _onConvertDocClick, true);
    document.removeEventListener('keydown', _onConvertKey, true);
  }
  function _onConvertDocClick(e) { if (_convertMenuEl && !_convertMenuEl.contains(e.target) && !e.target.closest('.ce-toolbar__convert-btn')) _closeConvertMenu(); }
  function _onConvertKey(e) { if (e.key === 'Escape') _closeConvertMenu(); }

  function _openConvertMenu(anchor) {
    _closeConvertMenu();
    const indices = _convertTargetIndices();
    const menu = document.createElement('div');
    menu.className = 'convert-menu';
    const count = indices.length;
    const head = document.createElement('div');
    head.className = 'convert-menu__head';
    head.textContent = count > 1 ? `${count}개 블록을 전환` : '전환할 유형 선택';
    menu.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'convert-menu__grid';
    _CONVERT_TYPES.forEach(t => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'convert-menu__item';
      item.textContent = t.label;
      item.addEventListener('click', (e) => { e.stopPropagation(); _closeConvertMenu(); _convert(indices, t); });
      grid.appendChild(item);
    });
    menu.appendChild(grid);
    document.body.appendChild(menu);
    _convertMenuEl = menu;

    // 위치: 버튼 오른쪽, 화면 넘치면 보정
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = r.right + 6, top = r.top;
    if (left + mw > window.innerWidth - 8) left = Math.max(8, r.left - mw - 6);
    if (top + mh > window.innerHeight - 8) top = Math.max(8, window.innerHeight - mh - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    setTimeout(() => {
      document.addEventListener('click', _onConvertDocClick, true);
      document.addEventListener('keydown', _onConvertKey, true);
    }, 0);
  }

  /* =========================================================
     이미지 (Storage + Blob URL 캐시/회수)
  ========================================================= */
  async function loadImage(fileId) {
    if (!fileId) return null;
    if (_blobUrlCache[fileId]) return _blobUrlCache[fileId];
    const url = await Storage.getImageBlobUrl(fileId);
    _blobUrlCache[fileId] = url;
    return url;
  }
  const loadCoverImage = loadImage;

  function _revokeBlobs() {
    Object.values(_blobUrlCache).forEach(u => {
      if (typeof u === 'string' && u.startsWith('blob:')) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    });
    _blobUrlCache = {};
  }

  /* =========================================================
     데이터 추출 / 파괴
  ========================================================= */
  // 에디터 데이터 반환. 준비 안 됨/오류면 null (빈 데이터로 덮어써 저장하지 않도록).
  // isReady 가 끝내 안 끝나도 최대 8초만 대기 → 이동/저장이 영영 멈추지 않음(안정성).
  async function getEditorData() {
    const ed = _editor;                       // 지역 캡처(전환 중 재할당 방지)
    if (!ed || !ed.isReady) return null;
    try {
      const ready = await Promise.race([
        ed.isReady.then(() => true),
        new Promise(res => setTimeout(() => res(false), 8000)),
      ]);
      if (!ready || _editor !== ed || typeof ed.save !== 'function') return null; // 미준비/전환/파괴
      return await ed.save();
    } catch (e) {
      return null;
    }
  }

  /* 라이브 에디터의 하위문서(pageLink) 링크를 newOrder(자식 id 순서)에 맞춰 재배치.
     슬롯 위치는 그대로 두고 각 슬롯의 pageId 만 재할당(순열) → 안전. (사이드바 → 본문) */
  async function reorderPageLinks(newOrder) {
    if (!_editor) return false;
    try {
      await _editor.isReady;
      const out = await _editor.save();
      const slots = [];
      (out.blocks || []).forEach(b => {
        if (b.type === 'pageLink' && b.data && b.data.pageId) slots.push({ id: b.id, pageId: b.data.pageId });
      });
      if (slots.length < 2) return false;
      const rank = (id) => { const k = newOrder.indexOf(id); return k === -1 ? Number.MAX_SAFE_INTEGER : k; };
      const desired = slots.map(s => s.pageId).sort((a, b) => rank(a) - rank(b));
      for (let k = 0; k < slots.length; k++) {
        if (slots[k].pageId !== desired[k]) {
          try { await _editor.blocks.update(slots[k].id, { pageId: desired[k] }); } catch (e) { /* 무시 */ }
        }
      }
      return true;
    } catch (e) {
      console.warn('pageLink 재배치 실패:', e);
      return false;
    }
  }

  function destroy() {
    _teardownDrag();
    _closeConvertMenu();
    clearTimeout(_changeDebounce);
    clearTimeout(_snapTimer);
    _undo = []; _redo = []; _curState = null; _pending = false;
    if (_editor) {
      try { _editor.destroy(); } catch {}
      _editor = null;
    }
    _revokeBlobs();
    _notifyHistory();
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    init,
    getEditorData,
    reorderPageLinks,
    loadImage,
    loadCoverImage,
    destroy,
    undo,
    redo,
    canUndo,
    canRedo,
    setHistoryListener,
    convert: _convert,                 // (indices, {type,level?,style?})
    convertTargetIndices: _convertTargetIndices,
    get instance() { return _editor; },
  };
})();
