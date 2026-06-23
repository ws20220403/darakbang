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
        Workspace.markDirty();
        clearTimeout(_changeDebounce);
        // [v8] 연동(목차·사이드바·되돌리기 스냅샷) 반영을 더 빠르게: 400 → 250ms.
        //      입력이 멈춘 직후에만 발화하므로 연속 입력 중엔 부하 없음(틱당 ~4ms).
        _changeDebounce = setTimeout(() => {
          document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
        }, 250);
      },
      onReady: () => {
        _setupDrag();
        _setupCodeAutosize();
        _setupBackspaceGuard();   // [v9] 빈/특수 블록 백스페이스 처리(요구사항 3)
        if (typeof AutoFormat !== 'undefined') AutoFormat.attach(_editor);   // [v6] 입력 자동변환
      },
    });

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
        // [v7] '변환' 지원을 더한 래퍼(blocks.js). 미정의 시 원본 CodeTool 로 안전 폴백.
        class: (typeof DarakCodeTool !== 'undefined' ? DarakCodeTool : CodeTool),
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
      holder.removeEventListener('keydown', _onBackspaceCapture, true);   // [v9]
    }
    if (typeof AutoFormat !== 'undefined') AutoFormat.detach();   // [v6] 입력 자동변환 정리
    _cancelDrag();
  }

  /* =========================================================
     [v9] 특수/빈 블록에서의 백스페이스 처리 (요구사항 3)
     - 토글·목록·체크리스트·콜아웃·인용구의 '첫 줄 맨 앞'에서 Backspace 를 누르면,
       Editor.js 기본 동작(윗블록으로 탈출/병합)으로 윗줄이 지워지는 문제를 막고,
       그 줄을 '일반 문단으로 풀기'(서식 제거, 글자 유지)로 바꾼다. 윗줄은 절대 건드리지 않는다.
       · 빈 줄  → 빈 문단으로(=추가기능 해제). 한 번 더 누르면 그때 표준 병합.
       · 글자 有 → 글자를 유지한 문단으로.
       · 목록/체크리스트가 여러 줄이면 첫 줄만 문단으로 빼고 나머지는 목록으로 유지(분할).
     - 줄 중간/둘째 줄 이후의 Backspace 는 가로채지 않음(도구 기본 동작 유지).
  ========================================================= */
  const _SPECIAL_BACKSPACE = new Set(['toggle', 'list', 'checklist', 'callout', 'quote']);

  function _setupBackspaceGuard() {
    const holder = document.getElementById('editorjs');
    if (!holder) return;
    holder.removeEventListener('keydown', _onBackspaceCapture, true);
    holder.addEventListener('keydown', _onBackspaceCapture, true);   // capture: 도구/코어보다 먼저
  }

  // 캐럿이 들어있는 블록 {idx, block} — Editor.js API + DOM 위치로 보정(커스텀 블록에서 더 안전)
  function _currentBlockInfo(ed, node) {
    let idx = -1;
    try { idx = ed.blocks.getCurrentBlockIndex(); } catch {}
    const host = node && (node.nodeType === 3 ? node.parentElement : node);
    const blockEl = host && host.closest ? host.closest('.ce-block') : null;
    if (blockEl) {
      const all = Array.from(document.querySelectorAll('#editorjs .codex-editor__redactor > .ce-block'));
      const di = all.indexOf(blockEl);
      if (di >= 0) idx = di;
    }
    if (idx < 0) return null;
    let block; try { block = ed.blocks.getBlockByIndex(idx); } catch {}
    return block ? { idx, block } : null;
  }

  function _onBackspaceCapture(e) {
    if (e.key !== 'Backspace' || e.isComposing) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;
    const ed = _editor;
    if (!ed || !ed.blocks) return;

    const info = _currentBlockInfo(ed, sel.anchorNode);
    if (!info || !_SPECIAL_BACKSPACE.has(info.block.name)) return;

    const holder = info.block.holder;
    if (!holder) return;
    const editables = Array.from(holder.querySelectorAll('[contenteditable="true"],[contenteditable=""]'));
    if (!editables.length) return;

    // 캐럿이 있는 '줄'(편집영역) 찾기
    let lineEl = null;
    for (let el = (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
         el && el !== holder; el = el.parentElement) {
      if (editables.indexOf(el) !== -1) { lineEl = el; break; }
    }
    if (!lineEl || lineEl !== editables[0]) return;   // 블록 '첫 줄'에서만 개입(둘째 줄 이후는 도구에 맡김)

    // 캐럿이 그 줄 맨 앞인지(앞에 글자 없음)
    let atStart = false;
    try {
      const r = sel.getRangeAt(0).cloneRange();
      r.selectNodeContents(lineEl);
      r.setEnd(sel.anchorNode, sel.anchorOffset);
      atStart = r.toString().length === 0;
    } catch {}
    if (!atStart) return;

    // 여기서부터 가로채서 '문단으로 풀기'
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    _unwrapToParagraph(ed, info.idx, info.block).catch(err => console.warn('백스페이스 변환 실패:', err));
  }

  async function _unwrapToParagraph(ed, idx, block) {
    const type = block.name;
    const holder = block.holder;
    const editables = holder ? Array.from(holder.querySelectorAll('[contenteditable="true"],[contenteditable=""]')) : [];
    const clean = (s) => (s && String(s).trim() && String(s).trim() !== '<br>') ? s : '';

    let saved = null;
    try { saved = await block.save(); } catch {}
    const data = (saved && saved.data) ? saved.data : null;

    let html = editables[0] ? editables[0].innerHTML : '';   // 기본값(DOM)
    let remaining = null;                                    // 아래에 남길 목록/체크리스트

    if (data) {
      if (type === 'toggle') {
        html = [clean(data.title), clean(data.content)].filter(Boolean).join('<br>');
      } else if (type === 'callout') {
        html = data.text || html;
      } else if (type === 'quote') {
        html = [clean(data.text), clean(data.caption)].filter(Boolean).join('<br>');
      } else if (type === 'checklist') {
        const items = Array.isArray(data.items) ? data.items : [];
        html = items[0] ? (items[0].text || '') : '';
        if (items.length > 1) remaining = { type: 'checklist', data: { items: items.slice(1) } };
      } else if (type === 'list') {
        const items = Array.isArray(data.items) ? data.items : [];
        const first = items[0];
        html = first ? (typeof first === 'string' ? first : (first.content || '')) : '';
        const sub = (first && Array.isArray(first.items)) ? first.items : [];
        const rest = [...sub, ...items.slice(1)];
        if (rest.length) remaining = { type: 'list', data: { style: data.style || 'unordered', items: rest } };
      }
    } else {
      // 저장 데이터를 못 읽으면 모든 줄을 합쳐 무손실 평문으로(구조만 평탄화)
      html = editables.map(el => clean(el.innerHTML)).filter(Boolean).join('<br>');
    }

    // 현재 블록을 같은 자리에서 문단으로 교체(윗블록은 건드리지 않음)
    ed.blocks.insert('paragraph', { text: html }, {}, idx, true, true);
    if (remaining) {
      try { ed.blocks.insert(remaining.type, remaining.data, {}, idx + 1, false); }
      catch (err) { console.warn('남은 목록 재삽입 실패:', err); }
    }
    try { ed.caret.setToBlock(idx, 'start'); } catch {}
    Workspace.markDirty();
    document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
  }

  function _onHoverMove(e) {
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
    clearTimeout(_changeDebounce);
    if (_editor) {
      try { _editor.destroy(); } catch {}
      _editor = null;
    }
    _revokeBlobs();
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
    get instance() { return _editor; },
  };
})();
