/**
 * autoformat.js — 입력 중 자동 변환  [v6 신규]
 *
 * 1) 인라인 기호 치환(커서 앞 글자 기준, 즉시):
 *      ->  →   →        <-  →   ←
 *      =>  →   ⇒(두꺼운)  <=  →   ⇐(두꺼운)
 *      (c) → ©   (r) → ®   (tm) → ™   != → ≠   ... → …
 *
 * 2) 줄머리 마크다운 변환(빈 문단에서 접두어 입력 시 블록 전환 — Notion식):
 *      "# "·"## "·"### "  → 제목 1·2·3
 *      "- "·"* "          → 글머리 목록
 *      "1. "              → 번호 목록
 *      "> "               → 토글            [v8] 인용구 → 토글로 변경
 *      "```"              → 코드
 *      "[]"·"[ ]"         → 체크리스트(요구사항)
 *
 * 안전장치
 *  - 본문 에디터(#editorjs)의 contenteditable 에서만 동작. 코드 textarea/입력창 제외.
 *  - 한글 조합 중(IME)에는 간섭하지 않음(e.isComposing).
 *  - 되돌리기/복원 적용 중에는 동작하지 않음(History.isApplying).
 *  - 치환은 텍스트 노드만 직접 수정 → input 이벤트 재발생 없음(무한루프 없음).
 *
 * 의존: EditorManager(instance), Workspace(markDirty), History(선택)
 * 공개: attach(editor) / detach()
 */

const AutoFormat = (() => {

  let _holder = null;
  let _editor = null;
  let _busy = false;

  // 긴 패턴이 먼저 매칭되도록 길이 내림차순 정렬
  const INLINE = [
    ['->', '→'], ['<-', '←'], ['=>', '⇒'], ['<=', '⇐'],
    ['(tm)', '™'], ['(c)', '©'], ['(r)', '®'],
    ['!=', '≠'], ['...', '…'],
  ].sort((a, b) => b[0].length - a[0].length);

  // 줄머리 변환(문단 전체 텍스트가 정확히 접두어일 때만)
  const BLOCK = [
    { re: /^#\s$/,       type: 'header',    data: { text: '', level: 1 } },
    { re: /^##\s$/,      type: 'header',    data: { text: '', level: 2 } },
    { re: /^###\s$/,     type: 'header',    data: { text: '', level: 3 } },
    { re: /^[-*]\s$/,    type: 'list',      data: { style: 'unordered', items: [{ content: '', items: [] }] } },
    { re: /^1\.\s$/,     type: 'list',      data: { style: 'ordered',   items: [{ content: '', items: [] }] } },
    { re: /^>\s$/,       type: 'toggle',    data: { title: '', content: '', isOpen: true } },   // [v8] '>' → 토글(기존 인용구에서 변경)
    { re: /^```$/,       type: 'code',      data: { code: '' } },
    { re: /^\[\]$/,      type: 'checklist', data: { items: [{ text: '', checked: false }] } },
    { re: /^\[\s\]$/,    type: 'checklist', data: { items: [{ text: '', checked: false }] } },
  ];

  function attach(editor) {
    _editor = editor || null;
    _holder = document.getElementById('editorjs');
    if (!_holder) return;
    detach();
    _holder.addEventListener('input', _onInput, true);
  }

  function detach() {
    if (_holder) _holder.removeEventListener('input', _onInput, true);
  }

  function _onInput(e) {
    if (_busy) return;
    if (e.isComposing) return;                          // 한글 조합 중 — 간섭 금지
    if (typeof History !== 'undefined' && History.isApplying && History.isApplying()) return;
    const t = e.target;
    if (!t || t.nodeType !== 1) return;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return;   // 코드블록 등 제외
    if (!t.isContentEditable) return;

    if (_tryInline()) return;        // 인라인 치환이 일어났으면 줄머리 변환은 생략
    _tryBlock(t);
  }

  /* 커서 바로 앞 글자가 변환 대상이면 치환 */
  function _tryInline() {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false;     // 텍스트 노드만
    const offset = sel.anchorOffset;
    const text = node.nodeValue || '';
    const before = text.slice(0, offset);

    for (const [from, to] of INLINE) {
      if (before.endsWith(from)) {
        const start = offset - from.length;
        _busy = true;
        node.nodeValue = text.slice(0, start) + to + text.slice(offset);
        const pos = Math.min(start + to.length, node.nodeValue.length);
        try {
          const r = document.createRange();
          r.setStart(node, pos);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        } catch {}
        _busy = false;
        Workspace.markDirty();
        return true;
      }
    }
    return false;
  }

  /* 빈 문단에 줄머리 접두어를 입력하면 해당 블록으로 전환 */
  function _tryBlock(el) {
    if (!el.classList || !el.classList.contains('ce-paragraph')) return;
    const txt = el.textContent || '';
    const match = BLOCK.find(b => b.re.test(txt));
    if (!match) return;

    const ed = _editor || EditorManager.instance;
    if (!ed || !ed.blocks || typeof ed.blocks.insert !== 'function') return;

    _busy = true;
    // input 처리가 끝난 뒤 안전하게 블록 교체(Editor.js 내부 처리와 충돌 방지)
    setTimeout(() => {
      try {
        const i = ed.blocks.getCurrentBlockIndex();
        if (i == null || i < 0) return;
        // 접두어만 있는 문단을 같은 자리에서 목표 블록으로 교체(replace=true), 포커스 이동
        ed.blocks.insert(match.type, JSON.parse(JSON.stringify(match.data)), {}, i, true, true);
        Workspace.markDirty();
        document.dispatchEvent(new CustomEvent('darakbang:editorChanged'));
      } catch (err) {
        console.warn('자동 블록 변환 실패:', err);
      } finally {
        _busy = false;
      }
    }, 0);
  }

  return { attach, detach };
})();
