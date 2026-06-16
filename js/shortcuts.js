/**
 * shortcuts.js — 단축키 · 편의기능 안내 (v7 신규)
 *
 * 상단 툴바의 '단축키' 버튼(⌨️)을 누르면 편의기능별로 그룹화된 안내 창이 열린다.
 * 내용은 정적 데이터(GROUPS)로만 구성된다 → 사용자 입력이 섞이지 않아 XSS 위험 없음
 * (그래도 모든 표시 텍스트는 textContent 로 넣어 안전하게 렌더).
 *
 * 의존: index.html 의 #modal-shortcuts 마크업. 외부 라이브러리 없음.
 * 공개: open() / close()
 */
const Shortcuts = (() => {

  // OS 에 맞춘 보조키 표기(⌘ / Ctrl)
  const _isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const MOD = _isMac ? '⌘' : 'Ctrl';

  /* 그룹별 안내.
     rows 항목 형식 두 가지
       · 키/흐름:   { keys:[...], sep?:'+'|'/'|'→', desc }
       · 자동변환:  { from:'->', to:'→' }                  (기호 그룹 전용) */
  const GROUPS = [
    {
      icon: '➕', title: '블록 추가 · 변환',
      desc: '문단을 제목·목록·코드·토글 등 다른 형식으로 만들거나 바꿉니다.',
      rows: [
        { keys: ['/'], desc: '빈 줄에서 입력 → 블록 추가 메뉴(검색·방향키·Enter 로 선택)' },
        { keys: ['+'], desc: '줄 왼쪽의 + 버튼 → 블록 추가 메뉴' },
        { keys: ['글자 선택', '변환'], sep: '→', desc: '뜨는 도구막대의 “변환”으로 블록 종류 바꾸기' },
        { keys: ['⠿', '변환'], sep: '→', desc: '블록 손잡이(⠿) 클릭 후 “변환”' },
      ],
      note: '변환 가능: 텍스트 · 제목 · 목록 · 체크리스트 · 인용구 · 코드 · 토글',
    },
    {
      icon: '✨', title: '자동 변환 — 기호',
      desc: '입력하는 즉시 기호로 바뀝니다. (코드 블록·한글 조합 중에는 작동하지 않음)',
      symbols: true,
      rows: [
        { from: '->', to: '→' }, { from: '<-', to: '←' },
        { from: '=>', to: '⇒' }, { from: '<=', to: '⇐' },
        { from: '!=', to: '≠' }, { from: '...', to: '…' },
        { from: '(c)', to: '©' }, { from: '(r)', to: '®' }, { from: '(tm)', to: '™' },
      ],
    },
    {
      icon: '＃', title: '자동 변환 — 줄머리(마크다운)',
      desc: '빈 줄 맨 앞에서 접두어를 입력하면 그 줄이 해당 블록으로 바뀝니다.',
      rows: [
        { keys: ['#', '##', '###'], sep: '/', desc: '뒤에 칸(스페이스) → 제목 1 · 2 · 3' },
        { keys: ['-', '*'], sep: '/', desc: '뒤에 칸 → 글머리 목록' },
        { keys: ['1.'], desc: '뒤에 칸 → 번호 목록' },
        { keys: ['>'], desc: '뒤에 칸 → 토글' },
        { keys: ['```'], desc: '→ 코드 블록' },
        { keys: ['[]', '[ ]'], sep: '/', desc: '→ 체크리스트' },
      ],
      note: '토글 내용 안에서도 “- ”·“* ” → •, “1. ” → 번호로 줄머리가 이어집니다(Enter 로 계속).',
    },
    {
      icon: '⌨️', title: '편집 단축키',
      rows: [
        { keys: [MOD, 'S'], desc: '저장' },
        { keys: [MOD, 'Z'], desc: '되돌리기 (입력이 멈춘 지점 기준 묶음 단위)' },
        { keys: [MOD, 'Shift', 'Z'], desc: '복원 (다시 실행)' },
        { keys: [MOD, 'Y'], desc: '복원 (다른 방식)' },
        { keys: ['글자 선택'], desc: '굵게 · 기울임 · 밑줄 · 인라인 코드 · 링크 도구막대' },
        { keys: ['Enter'], desc: '페이지 제목 칸에서 누르면 본문으로 이동' },
        { keys: ['토글 제목', 'Enter'], sep: '→', desc: '아래에 새 토글 생성 (빈 제목이면 일반 문단으로 빠져나감)' },
        { keys: ['토글 내용', 'Enter'], sep: '→', desc: '토글 안에서 줄바꿈 (밖으로 나가지 않음)' },
        { keys: ['Tab'], desc: '목록에서 들여쓰기' },
        { keys: ['Shift', 'Tab'], desc: '목록에서 내어쓰기' },
        { keys: ['Esc'], desc: '열린 메뉴·창 닫기' },
      ],
    },
    {
      icon: '🧮', title: '표 안에서',
      rows: [
        { keys: ['↑', '↓', '←', '→'], sep: '/', desc: '셀 이동 (좌우는 글자 끝에서 옆 칸으로)' },
        { keys: ['Tab'], desc: '오른쪽 칸으로 이동' },
        { keys: ['Enter'], desc: '아래 칸으로 이동 (빈 줄이 생기지 않음)' },
        { keys: ['='], desc: '함수 입력 시작 — 좌표(A·B·C / 1·2·3)와 함수 힌트 표시' },
        { keys: ["'"], desc: "맨 앞에 붙이면 수식을 계산하지 않고 글자로 둠 (예: '=D5)" },
      ],
      note: '함수: =SUM · AVERAGE · MAX · MIN · COUNT · PRODUCT · ROUND · ABS, 사칙연산과 범위(A1:B3)',
    },
    {
      icon: '↕️', title: '블록 · 페이지 관리',
      rows: [
        { keys: ['⠿ 드래그'], desc: '블록 순서 바꾸기 (파란 선이 놓일 위치를 표시)' },
        { keys: ['⠿ 클릭'], desc: '위로 · 아래로 · 삭제 메뉴 열기' },
        { keys: ['⋯'], desc: '사이드바 페이지 메뉴 — 하위추가 · 복제 · 이름변경 · 삭제 · 즐겨찾기 · 이동 · 내보내기' },
      ],
    },
  ];

  let _built = false;
  let _open = false;
  let _lastFocus = null;

  function _kbd(text) {
    const k = document.createElement('kbd');
    k.className = 'sc-key';
    k.textContent = text;
    return k;
  }

  function _keysFragment(keys, sep) {
    const frag = document.createDocumentFragment();
    keys.forEach((key, i) => {
      if (i > 0) {
        const s = document.createElement('span');
        s.className = 'sc-sep';
        s.textContent = sep || '+';
        frag.appendChild(s);
      }
      frag.appendChild(_kbd(key));
    });
    return frag;
  }

  function _renderGroup(group) {
    const sec = document.createElement('section');
    sec.className = 'sc-group';

    const head = document.createElement('div');
    head.className = 'sc-group__head';
    const ic = document.createElement('span');
    ic.className = 'sc-group__icon';
    ic.textContent = group.icon;
    const tt = document.createElement('span');
    tt.className = 'sc-group__title';
    tt.textContent = group.title;
    head.append(ic, tt);
    sec.appendChild(head);

    if (group.desc) {
      const d = document.createElement('p');
      d.className = 'sc-group__desc';
      d.textContent = group.desc;
      sec.appendChild(d);
    }

    if (group.symbols) {
      const grid = document.createElement('div');
      grid.className = 'sc-symbols';
      group.rows.forEach(r => {
        const cell = document.createElement('div');
        cell.className = 'sc-symbol';
        cell.appendChild(_kbd(r.from));
        const arr = document.createElement('span');
        arr.className = 'sc-symbol__arrow';
        arr.textContent = '→';
        const to = document.createElement('span');
        to.className = 'sc-symbol__to';
        to.textContent = r.to;
        cell.append(arr, to);
        grid.appendChild(cell);
      });
      sec.appendChild(grid);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'sc-rows';
      group.rows.forEach(r => {
        const li = document.createElement('li');
        li.className = 'sc-row';
        const keys = document.createElement('span');
        keys.className = 'sc-row__keys';
        keys.appendChild(_keysFragment(r.keys, r.sep));
        const desc = document.createElement('span');
        desc.className = 'sc-row__desc';
        desc.textContent = r.desc || '';
        li.append(keys, desc);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
    }

    if (group.note) {
      const n = document.createElement('p');
      n.className = 'sc-group__note';
      n.textContent = group.note;
      sec.appendChild(n);
    }
    return sec;
  }

  function _build() {
    const body = document.getElementById('modal-shortcuts-body');
    if (!body) return;
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sc-grid';
    GROUPS.forEach(g => grid.appendChild(_renderGroup(g)));
    body.appendChild(grid);
    _built = true;
  }

  function open() {
    const overlay = document.getElementById('modal-shortcuts');
    if (!overlay) return;
    if (!_built) _build();
    _lastFocus = document.activeElement;
    _open = true;
    overlay.classList.remove('hidden');
    overlay.removeAttribute('aria-hidden');
    document.addEventListener('keydown', _onKey, true);
    const closeBtn = document.getElementById('modal-shortcuts-close');
    closeBtn?.addEventListener('click', close);
    // 여는 클릭이 그대로 오버레이의 '바깥 클릭 닫기'로 새어 즉시 닫히지 않도록
    // 바깥 클릭 닫기는 다음 틱에 연결한다(이모지 피커와 동일한 방식).
    setTimeout(() => { if (_open) overlay.addEventListener('click', _onOverlay); }, 0);
    closeBtn?.focus();
  }

  function close() {
    const overlay = document.getElementById('modal-shortcuts');
    if (!overlay) return;
    _open = false;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', _onKey, true);
    overlay.removeEventListener('click', _onOverlay);
    document.getElementById('modal-shortcuts-close')?.removeEventListener('click', close);
    try { _lastFocus && _lastFocus.focus && _lastFocus.focus(); } catch {}
    _lastFocus = null;
  }

  // Esc 로 닫기(다른 핸들러로 새지 않도록 capture + stop)
  function _onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }
  function _onOverlay(e) {
    if (e.target && e.target.id === 'modal-shortcuts') close();
  }

  return { open, close };
})();
