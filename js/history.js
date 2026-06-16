/**
 * history.js — 되돌리기(Undo) / 복원(Redo) 매니저  [v6 신규]
 *
 * Editor.js 는 블록 간(추가/삭제/이동) 되돌리기를 기본 제공하지 않으므로,
 * 문서 전체 스냅샷을 쌓아 직접 구현한다.
 *
 * 설계 핵심
 *  - HWP식 "어절 묶음" 단위: 스냅샷은 입력이 멈춘 뒤(≈400ms 유휴) 한 번만 기록된다.
 *    → 연속 입력 한 묶음 = 1개의 되돌리기 단위(글자 단위로 잘게 쪼개지지 않아 편함).
 *    (기록 시점은 app.js 의 'darakbang:editorChanged'(이미 400ms 디바운스)에 연동)
 *  - 되돌리기/복원은 blocks.render(스냅샷)으로 복원하고, 바뀐 블록 근처로 커서를 옮긴다.
 *  - 스택 상한(MAX)으로 메모리 고정. 스냅샷은 직렬화 가능한 순수 데이터(누수 없음).
 *  - 페이지마다 독립(페이지 전환 시 reset). 본문(Editor.js) 내용만 대상으로 한다.
 *
 * 의존: EditorManager(instance/getEditorData), Workspace(markDirty)
 * 공개: reset / record / undo / redo / canUndo / canRedo / isApplying
 */

const History = (() => {

  const MAX = 60;                 // 스냅샷 최대 개수(메모리 상한)

  let _stack = [];                // [{ blocks, sig }]  — sig: id 제외 내용 서명
  let _index = -1;                // 현재 스냅샷 위치
  let _applying = false;          // 되돌리기/복원 적용 중(기록 억제)
  let _busy = false;              // undo/redo 연타 직렬화

  /* ---------- 유틸 ---------- */
  function _clone(b) {
    try { return JSON.parse(JSON.stringify(b)); } catch { return Array.isArray(b) ? b.slice() : b; }
  }
  // 블록 id 는 무시하고 '내용'만으로 서명 → render 로 id 가 바뀌어도 같은 상태로 인식(중복 방지).
  function _sig(blocks) {
    try { return JSON.stringify((blocks || []).map(b => [b.type, b.data])); }
    catch { return String(Math.random()); }
  }
  function _blocksOf(data) {
    return (data && Array.isArray(data.blocks)) ? data.blocks : [];
  }
  // a→b 로 갈 때 처음으로 달라지는 블록 인덱스(커서를 그쪽으로 보냄)
  function _firstDiff(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (JSON.stringify([a[i].type, a[i].data]) !== JSON.stringify([b[i].type, b[i].data])) return i;
    }
    return Math.max(0, Math.min(n, b.length - 1));
  }

  function _emit() {
    try {
      document.dispatchEvent(new CustomEvent('darakbang:historyChanged', {
        detail: { canUndo: canUndo(), canRedo: canRedo() },
      }));
    } catch {}
  }

  /* ---------- 상태 조회 ---------- */
  function canUndo() { return _index > 0; }
  function canRedo() { return _index >= 0 && _index < _stack.length - 1; }
  function isApplying() { return _applying; }

  /* ---------- 초기화(페이지 로드/전환) ---------- */
  function reset(data) {
    _applying = false;
    _busy = false;
    const blocks = _blocksOf(data);
    _stack = [{ blocks: _clone(blocks), sig: _sig(blocks) }];
    _index = 0;
    _emit();
  }

  /* ---------- 스냅샷 기록(유휴 변경 시) ---------- */
  function record(data) {
    if (_applying) return;                     // 적용 중에는 기록하지 않음
    const blocks = _blocksOf(data);
    const sig = _sig(blocks);
    if (_stack.length && _index >= 0 && sig === _stack[_index].sig) return;  // 변화 없음 → 무시
    _stack = _stack.slice(0, _index + 1);      // 되돌린 뒤 새로 쓰면 복원 가지(redo) 폐기
    _stack.push({ blocks: _clone(blocks), sig });
    if (_stack.length > MAX) _stack = _stack.slice(_stack.length - MAX);
    _index = _stack.length - 1;
    _emit();
  }

  /* ---------- 적용(스냅샷 → 에디터) ---------- */
  async function _apply(entry, fromBlocks) {
    const ed = EditorManager.instance;
    if (!ed || !ed.blocks || typeof ed.blocks.render !== 'function') return;
    _applying = true;
    try {
      if (ed.isReady) { try { await ed.isReady; } catch {} }
      // [v8] Editor.js 의 blocks.render 프로미스가 토글/콜아웃이 있으면 resolve 되지 않는 이슈가 있어
      //      (DOM 은 즉시 그려짐) 타임아웃과 경쟁시켜 되돌리기/복원이 영영 멈추지 않게 한다.
      await Promise.race([
        Promise.resolve(ed.blocks.render({ blocks: _clone(entry.blocks) })),
        new Promise(r => setTimeout(r, 400)),
      ]);
      // 바뀐 블록 근처로 커서 이동(편집 흐름 유지)
      try {
        const target = entry.blocks;
        if (target.length && ed.caret && typeof ed.caret.setToBlock === 'function') {
          let idx = fromBlocks ? _firstDiff(fromBlocks, target) : 0;
          idx = Math.max(0, Math.min(idx, target.length - 1));
          ed.caret.setToBlock(idx, 'end');
        }
      } catch {}
      Workspace.markDirty();
      // 자동저장 예약 + 목차/사이드바 동기화(app.js 가 수신).
      // fromHistory 플래그로 '되돌리기發 변경'임을 알려 하위문서 오삭제/중복기록을 막는다.
      // (_applying 은 동기 종료 후 곧 false 가 되므로, 비동기 핸들러엔 이벤트 detail 로 전달)
      document.dispatchEvent(new CustomEvent('darakbang:editorChanged', { detail: { fromHistory: true } }));
    } catch (e) {
      console.warn('되돌리기/복원 적용 실패:', e);
    } finally {
      _applying = false;
      _emit();
    }
  }

  // 아직 기록되지 않은 '진행 중 입력'을 먼저 스냅샷으로 확정(연타·즉시 되돌리기 대비)
  async function _commitPending() {
    try {
      const cur = await EditorManager.getEditorData();
      if (cur && Array.isArray(cur.blocks)) record(cur);
    } catch {}
  }

  /* ---------- 되돌리기 ---------- */
  async function undo() {
    if (_busy || _applying) return;
    _busy = true;
    try {
      await _commitPending();           // 진행 중 입력을 먼저 확정
      if (_index <= 0) return;
      const from = _stack[_index].blocks;
      _index--;
      await _apply(_stack[_index], from);
    } finally { _busy = false; }
  }

  /* ---------- 복원 ---------- */
  async function redo() {
    if (_busy || _applying) return;
    _busy = true;
    try {
      await _commitPending();           // 입력 후 즉시 복원 시 복원가지가 폐기되어 무효화(정상)
      if (!canRedo()) return;
      const from = _stack[_index].blocks;
      _index++;
      await _apply(_stack[_index], from);
    } finally { _busy = false; }
  }

  return { reset, record, undo, redo, canUndo, canRedo, isApplying };
})();
