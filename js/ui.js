/**
 * ui.js — 공통 UI 유틸리티
 * Toast, Modal, Emoji Picker, Context Menu 등
 */

const UI = (() => {

  /* =========================================================
     TOAST
  ========================================================= */
  const TOAST_DURATION = 3000;

  function toast(message, type = 'info', duration = TOAST_DURATION) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✅',
      error:   '❌',
      warning: '⚠️',
      info:    'ℹ️',
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    container.appendChild(el);

    const remove = () => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };

    const timer = setTimeout(remove, duration);
    el.addEventListener('click', () => { clearTimeout(timer); remove(); });

    return el;
  }

  /* [v9] 동작 버튼이 달린 토스트 — 자동으로 사라지지 않음(호출측이 반환된 요소를 .remove() 로 닫음).
     토큰 만료 시 '다시 연결' 안내에 사용. 컴포넌트 CSS 에 의존하지 않도록 버튼 스타일은 인라인. */
  function actionToast(message, type = 'warning', actionLabel = '확인', onAction = null) {
    const container = document.getElementById('toast-container');
    if (!container) return null;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'alert');

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', width: '100%' });

    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span> ${escapeHtml(message)}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = actionLabel;
    Object.assign(btn.style, {
      marginLeft: '8px', padding: '5px 14px', borderRadius: '6px', border: 'none',
      cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', flex: '0 0 auto',
      background: 'var(--color-brand, #6c63ff)', color: '#fff',
    });
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (onAction) onAction(); });

    row.appendChild(msg);
    row.appendChild(btn);
    el.appendChild(row);
    container.appendChild(el);
    return el;   // 자동 소멸 없음 — 호출측이 닫음
  }

  /* =========================================================
     MODAL — 삭제 확인
  ========================================================= */
  function confirmDelete(pageName, hasChildren) {
    return new Promise((resolve) => {
      const overlay  = document.getElementById('modal-delete');
      const bodyEl   = document.getElementById('modal-delete-body');
      const btnCancel  = document.getElementById('modal-delete-cancel');
      const btnConfirm = document.getElementById('modal-delete-confirm');

      let bodyText = `'${escapeHtml(pageName)}' 페이지를 삭제하시겠습니까?`;
      if (hasChildren) {
        bodyText += ' 하위 페이지도 함께 삭제됩니다.';
      }
      bodyText += ' 이 작업은 되돌릴 수 없습니다.';
      bodyEl.textContent = bodyText;

      overlay.classList.remove('hidden');
      overlay.removeAttribute('aria-hidden');
      btnConfirm.focus();

      const close = (result) => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        btnCancel.removeEventListener('click', onCancel);
        btnConfirm.removeEventListener('click', onConfirm);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKeydown);
        resolve(result);
      };

      const onCancel  = () => close(false);
      const onConfirm = () => close(true);
      const onOverlay = (e) => { if (e.target === overlay) close(false); };
      const onKeydown = (e) => { if (e.key === 'Escape') close(false); };

      btnCancel.addEventListener('click', onCancel);
      btnConfirm.addEventListener('click', onConfirm);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKeydown);
    });
  }

  /* =========================================================
     MODAL — 미저장 경고
  ========================================================= */
  function confirmUnsaved() {
    return new Promise((resolve) => {
      const overlay   = document.getElementById('modal-unsaved');
      const btnDiscard = document.getElementById('modal-unsaved-discard');
      const btnSave    = document.getElementById('modal-unsaved-save');

      overlay.classList.remove('hidden');
      overlay.removeAttribute('aria-hidden');
      btnSave.focus();

      const close = (result) => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        btnDiscard.removeEventListener('click', onDiscard);
        btnSave.removeEventListener('click', onSave);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKeydown);
        resolve(result); // 'save' | 'discard' | null
      };

      const onDiscard = () => close('discard');
      const onSave    = () => close('save');
      const onOverlay = (e) => { if (e.target === overlay) close(null); };
      const onKeydown = (e) => { if (e.key === 'Escape') close(null); };

      btnDiscard.addEventListener('click', onDiscard);
      btnSave.addEventListener('click', onSave);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKeydown);
    });
  }

  /* =========================================================
     MODAL — 링크 입력
  ========================================================= */
  // 범용 입력 모달 (브라우저 기본 prompt() 대체)
  function prompt(title, defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
      const overlay    = document.getElementById('modal-prompt');
      const titleEl    = document.getElementById('modal-prompt-title');
      const input      = document.getElementById('modal-prompt-input');
      const btnCancel  = document.getElementById('modal-prompt-cancel');
      const btnConfirm = document.getElementById('modal-prompt-confirm');

      titleEl.textContent = title || '입력';
      input.value = defaultValue || '';
      input.placeholder = placeholder || '';
      overlay.classList.remove('hidden');
      overlay.removeAttribute('aria-hidden');
      input.focus();
      input.select();

      const close = (result) => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        btnCancel.removeEventListener('click', onCancel);
        btnConfirm.removeEventListener('click', onConfirm);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKeydown);
        input.removeEventListener('keydown', onInputKeydown);
        resolve(result);
      };

      const onCancel  = () => close(null);
      const onConfirm = () => close(input.value.trim() || null);
      const onOverlay = (e) => { if (e.target === overlay) close(null); };
      const onKeydown = (e) => { if (e.key === 'Escape') close(null); };
      const onInputKeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); close(input.value.trim() || null); } };

      btnCancel.addEventListener('click', onCancel);
      btnConfirm.addEventListener('click', onConfirm);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKeydown);
      input.addEventListener('keydown', onInputKeydown);
    });
  }

  function promptLink(defaultUrl = '') {
    return prompt('링크 삽입', defaultUrl, 'https://...');
  }

  /* =========================================================
     EMOJI PICKER
  ========================================================= */
  // 주요 이모지 목록 (카테고리별)
  const EMOJIS = [
    '📄','📃','📋','📁','📂','🗂️','📑','📊','📈','📉',
    '📝','✏️','🖊️','🖋️','🖌️','📌','📍','🗓️','📅','📆',
    '🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏧','🏨','🏩',
    '⭐','🌟','💫','✨','🔥','💡','🎯','🎪','🎨','🎭',
    '💻','🖥️','🖨️','⌨️','🖱️','💾','💿','📀','📱','📲',
    '📚','📖','📗','📘','📙','📕','📔','📒','📓','📃',
    '🔑','🗝️','🔒','🔓','🔏','🔐','🔗','📎','🖇️','📏',
    '💬','💭','🗨️','🗯️','📢','📣','🔔','🔕','🔇','🔊',
    '🌈','☀️','🌙','⛅','🌤️','🌥️','🌦️','🌧️','⛈️','🌩️',
    '🌺','🌸','🌼','🌻','🌹','🌷','💐','🍀','🌿','🌱',
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🍎','🍊','🍋','🍇','🍓','🍑','🍒','🍌','🍉','🍍',
    '🎵','🎶','🎸','🥁','🎹','🎺','🎻','🎤','🎧','🎼',
    '🚀','✈️','🚂','🚗','🚕','🛸','🛶','⛵','🚢','🚁',
    '💎','👑','🏆','🥇','🥈','🥉','🎖️','🏅','🎗️','🎀',
    '🔬','🔭','⚗️','🧬','🧪','🧫','🧲','💊','💉','🩺',
    '📡','🔭','🌍','🌎','🌏','🗺️','🧭','⛰️','🏔️','🌋',
    '🦋','🐝','🐛','🦗','🕷️','🦂','🐢','🦎','🐍','🦕',
  ];

  // 이모지 검색 키워드 (행=10개 단위, EMOJIS 배열 카테고리와 일치)
  const EMOJI_KEYWORDS = [
    '문서 파일 폴더 차트 그래프 document file folder chart',     // 📄📃📋📁📂🗂️📑📊📈📉
    '메모 쓰기 펜 핀 달력 일정 note write pen pin calendar',      // 📝✏️🖊️🖋️🖌️📌📍🗓️📅📆
    '집 건물 home house building 빌딩',                            // 🏠🏡🏢🏣...
    '별 반짝 불 아이디어 목표 예술 star fire idea art sparkle',   // ⭐🌟💫✨🔥💡🎯🎪🎨🎭
    '컴퓨터 기기 폰 노트북 device computer phone laptop',         // 💻🖥️...📱📲
    '책 공부 독서 book study read 노트',                          // 📚📖📗...
    '열쇠 자물쇠 보안 링크 클립 key lock link security',          // 🔑🗝️🔒🔓🔏🔐🔗📎🖇️📏
    '말풍선 대화 알림 종 채팅 speech chat bell talk',             // 💬💭🗨️🗯️📢📣🔔🔕🔇🔊
    '날씨 해 달 비 무지개 weather sun moon rain rainbow',         // 🌈☀️🌙⛅...
    '꽃 식물 자연 flower plant nature 잎',                        // 🌺🌸🌼🌻🌹🌷💐🍀🌿🌱
    '동물 강아지 고양이 곰 토끼 animal dog cat bear',             // 🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯
    '하트 사랑 마음 heart love',                                  // ❤️🧡💛💚💙💜🖤🤍🤎💔
    '얼굴 웃음 표정 emoji face smile happy 감정',                 // 😀😃😄😁😆😅😂🤣😊😇
    '과일 음식 사과 fruit food apple 먹을것',                     // 🍎🍊🍋🍇🍓🍑🍒🍌🍉🍍
    '음악 노래 악기 music song guitar 기타',                      // 🎵🎶🎸🥁🎹🎺🎻🎤🎧🎼
    '이동 차 비행기 로켓 배 transport car plane rocket',          // 🚀✈️🚂🚗🚕🛸🛶⛵🚢🚁
    '상 트로피 보석 왕관 우승 award trophy crown win medal',      // 💎👑🏆🥇🥈🥉🎖️🏅🎗️🎀
    '과학 실험 연구 의학 science lab research medicine',          // 🔬🔭⚗️🧬🧪🧫🧲💊💉🩺
    '지구 세계 지도 우주 earth world map space globe',            // 📡🔭🌍🌎🌏🗺️🧭⛰️🏔️🌋
    '곤충 벌레 나비 bug insect butterfly',                        // 🦋🐝🐛🦗🕷️🦂🐢🦎🐍🦕
  ];
  const emojiKeywords = (i) => EMOJI_KEYWORDS[Math.floor(i / 10)] || '';

  let emojiCallback = null;
  let emojiPickerOpen = false;
  let _emojiActiveCat = 'all';   // [v9b] 활성 카테고리

  // [v9b] emoji-data.js(window.EMOJI_DATA) 사용. 없으면 옛 기본셋(EMOJIS)으로 폴백.
  const _emojiCats = (typeof EMOJI_DATA !== 'undefined' && Array.isArray(EMOJI_DATA) && EMOJI_DATA.length)
    ? EMOJI_DATA
    : [{ id: 'basic', label: '기본', icon: '📄', kw: '', emojis: (EMOJIS || []).join(' ') }];
  const _emojiAll = (typeof EMOJI_DATA !== 'undefined' && EMOJI_DATA.ALL) ? EMOJI_DATA.ALL : (EMOJIS || []);
  const _emojiSplit = (s) => (s || '').split(/\s+/).filter(Boolean);

  // 맨 위 '이모지 없음(제거)' 타일 — 엑셀의 '채우기 없음'처럼 (요구사항)
  const _emojiNoneTile = () =>
    `<button class="emoji-item emoji-item--none" data-none="1" title="이모지 없음(제거)" aria-label="이모지 없음">🚫 이모지 없음</button>`;
  const _emojiBtns = (list) =>
    list.map(e => `<button class="emoji-item" data-emoji="${e}" title="${e}" aria-label="${e}">${e}</button>`).join('');

  function _renderEmojiGrid(grid, query) {
    const q = (query || '').trim().toLowerCase();
    let html = _emojiNoneTile();          // '없음'은 항상 맨 위
    if (q) {
      // 카테고리 라벨/키워드 매칭 → 그 카테고리 전체. 매칭 없으면 이모지 문자 자체 검색.
      const cats = _emojiCats.filter(c => c.label.toLowerCase().includes(q) || (c.kw || '').toLowerCase().includes(q));
      let list;
      if (cats.length) {
        const seen = new Set(); list = [];
        cats.forEach(c => _emojiSplit(c.emojis).forEach(e => { if (!seen.has(e)) { seen.add(e); list.push(e); } }));
      } else {
        list = _emojiAll.filter(e => e === q || e.includes(q));
      }
      html += list.length ? _emojiBtns(list) : '<div class="emoji-empty">결과 없음</div>';
    } else if (_emojiActiveCat !== 'all') {
      const c = _emojiCats.find(x => x.id === _emojiActiveCat);
      html += _emojiBtns(_emojiSplit(c ? c.emojis : ''));
    } else {
      _emojiCats.forEach(c => { html += `<div class="emoji-cat-label">${c.label}</div>` + _emojiBtns(_emojiSplit(c.emojis)); });
    }
    grid.innerHTML = html;
  }

  function _renderEmojiChips(bar) {
    const chip = (id, label) => `<button class="emoji-chip${_emojiActiveCat === id ? ' is-active' : ''}" data-cat="${id}" title="${label}">${label}</button>`;
    bar.innerHTML = chip('all', '전체') + _emojiCats.map(c => chip(c.id, c.icon)).join('');
  }

  function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    const grid   = document.getElementById('emoji-grid');
    const searchInput = document.getElementById('emoji-search');
    if (!picker || !grid) return;

    // 카테고리 칩 바 (헤더와 그리드 사이에 1회 삽입)
    let bar = picker.querySelector('.emoji-cats');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'emoji-cats';
      grid.parentNode.insertBefore(bar, grid);
    }
    _renderEmojiChips(bar);
    _renderEmojiGrid(grid, '');

    // 리스너는 1회만 바인딩(재로그인 시 중복 방지)
    if (!picker.dataset.emojiBound) {
      picker.dataset.emojiBound = '1';

      // 칩 클릭(위임)
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('.emoji-chip'); if (!b) return;
        _emojiActiveCat = b.dataset.cat;
        bar.querySelectorAll('.emoji-chip').forEach(x => x.classList.toggle('is-active', x === b));
        if (searchInput) searchInput.value = '';
        _renderEmojiGrid(grid, '');
        grid.scrollTop = 0;
      });

      // 그리드 클릭(위임) — 이모지 선택 / '없음'(빈 문자열)
      grid.addEventListener('click', (e) => {
        const b = e.target.closest('.emoji-item'); if (!b) return;
        const val = b.dataset.none ? '' : (b.dataset.emoji || '');
        if (emojiCallback) emojiCallback(val);
        closeEmojiPicker();
      });

      // 검색
      searchInput?.addEventListener('input', () => { _renderEmojiGrid(grid, searchInput.value); grid.scrollTop = 0; });

      // 외부 클릭 / Esc 닫기
      document.addEventListener('click', (e) => {
        if (emojiPickerOpen && !picker.contains(e.target) && !e.target.closest('[data-emoji-trigger]')) closeEmojiPicker();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && emojiPickerOpen) closeEmojiPicker(); });
    }
  }

  function openEmojiPicker(anchorEl, callback) {
    const picker = document.getElementById('emoji-picker');
    const searchInput = document.getElementById('emoji-search');
    const grid = document.getElementById('emoji-grid');

    emojiCallback = callback;
    emojiPickerOpen = true;
    _emojiActiveCat = 'all';               // 열 때마다 전체 보기로 초기화
    const bar = picker.querySelector('.emoji-cats');
    if (bar) _renderEmojiChips(bar);
    if (searchInput) searchInput.value = '';
    if (grid) { _renderEmojiGrid(grid, ''); grid.scrollTop = 0; }

    // 위치 계산
    const rect = anchorEl.getBoundingClientRect();
    const pickerW = 340;
    const pickerH = 400;

    let left = rect.left;
    let top  = rect.bottom + 4;

    if (left + pickerW > window.innerWidth) {
      left = window.innerWidth - pickerW - 8;
    }
    if (top + pickerH > window.innerHeight) {
      top = Math.max(8, rect.top - pickerH - 4);
    }

    picker.style.left = `${Math.max(8, left)}px`;
    picker.style.top  = `${Math.max(8, top)}px`;
    picker.classList.remove('hidden');
    searchInput?.focus();
  }

  function closeEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.add('hidden');
    emojiPickerOpen = false;
    emojiCallback = null;
  }

  /* =========================================================
     CONTEXT MENU
  ========================================================= */
  let contextMenuCallback = null;

  function openContextMenu(x, y, options) {
    const menu = document.getElementById('context-menu');

    const ctxRename    = document.getElementById('ctx-rename');
    const ctxFavorite  = document.getElementById('ctx-favorite');
    const ctxNewSub    = document.getElementById('ctx-new-subpage');
    const ctxDelete    = document.getElementById('ctx-delete');
    const ctxMoveUp    = document.getElementById('ctx-move-up');
    const ctxMoveDown  = document.getElementById('ctx-move-down');
    const ctxDuplicate = document.getElementById('ctx-duplicate');
    const ctxExport    = document.getElementById('ctx-export');
    const moveSep      = document.getElementById('ctx-move-sep');

    // 즐겨찾기 텍스트 업데이트
    ctxFavorite.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="${options.favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      ${options.favorited ? '즐겨찾기 제거' : '즐겨찾기에 추가'}
    `;

    // 위로/아래로 (루트 페이지에서만) — 표시/비활성 토글
    const showMove = !!options.showMove;
    if (ctxMoveUp)   ctxMoveUp.classList.toggle('hidden', !showMove);
    if (ctxMoveDown) ctxMoveDown.classList.toggle('hidden', !showMove);
    if (moveSep)     moveSep.classList.toggle('hidden', !showMove);
    if (ctxMoveUp)   ctxMoveUp.classList.toggle('context-menu-item-disabled', !options.canMoveUp);
    if (ctxMoveDown) ctxMoveDown.classList.toggle('context-menu-item-disabled', !options.canMoveDown);

    // 위치
    let left = x;
    let top  = y;
    const menuW = 190;
    const menuH = 280;
    if (left + menuW > window.innerWidth) left = x - menuW;
    if (top  + menuH > window.innerHeight) top = Math.max(4, window.innerHeight - menuH - 4);

    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top  = `${Math.max(4, top)}px`;
    menu.classList.remove('hidden');

    const close = () => {
      menu.classList.add('hidden');
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeydown);
      ctxRename.removeEventListener('click', onRename);
      ctxFavorite.removeEventListener('click', onFavorite);
      ctxNewSub.removeEventListener('click', onNewSub);
      ctxDelete.removeEventListener('click', onDelete);
      ctxMoveUp?.removeEventListener('click', onMoveUp);
      ctxMoveDown?.removeEventListener('click', onMoveDown);
      ctxDuplicate?.removeEventListener('click', onDuplicate);
      ctxExport?.removeEventListener('click', onExport);
    };

    const onRename    = () => { close(); options.onRename?.(); };
    const onFavorite  = () => { close(); options.onFavorite?.(); };
    const onNewSub    = () => { close(); options.onNewSubpage?.(); };
    const onDelete    = () => { close(); options.onDelete?.(); };
    const onMoveUp    = () => { if (options.canMoveUp)   { close(); options.onMoveUp?.(); } };
    const onMoveDown  = () => { if (options.canMoveDown) { close(); options.onMoveDown?.(); } };
    const onDuplicate = () => { close(); options.onDuplicate?.(); };
    const onExport    = () => { close(); options.onExport?.(); };
    const onDocClick  = (e) => { if (!menu.contains(e.target)) close(); };
    const onKeydown   = (e) => { if (e.key === 'Escape') close(); };

    ctxRename.addEventListener('click', onRename);
    ctxFavorite.addEventListener('click', onFavorite);
    ctxNewSub.addEventListener('click', onNewSub);
    ctxDelete.addEventListener('click', onDelete);
    ctxMoveUp?.addEventListener('click', onMoveUp);
    ctxMoveDown?.addEventListener('click', onMoveDown);
    ctxDuplicate?.addEventListener('click', onDuplicate);
    ctxExport?.addEventListener('click', onExport);
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }

  /* =========================================================
     DARK MODE
  ========================================================= */
  function initTheme() {
    const stored = localStorage.getItem('darakbang_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('darakbang_theme', theme);

    // 아이콘 토글
    const sunIcon  = document.querySelector('.icon-sun');
    const moonIcon = document.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  /* =========================================================
     UTILITIES
  ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : (
      Date.now().toString(36) + Math.random().toString(36).slice(2)
    );
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function isOnline() {
    return navigator.onLine;
  }

  function isMobile() {
    return window.innerWidth <= 768;
  }

  /* =========================================================
     SIDEBAR RESIZE (PC)
  ========================================================= */
  function initSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    const handle  = document.getElementById('sidebar-resize');
    if (!sidebar || !handle) return;

    // 저장된 너비 복원
    const stored = parseInt(localStorage.getItem('darakbang_sidebar_width'));
    if (stored && stored >= 180 && stored <= 400) {
      sidebar.style.width = `${stored}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${stored}px`);
    }

    let isDragging = false;
    let startX = 0;
    let startW = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const diff = e.clientX - startX;
      const newW = Math.min(400, Math.max(180, startW + diff));
      sidebar.style.width = `${newW}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${newW}px`);
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('darakbang_sidebar_width', sidebar.offsetWidth);
    });
  }

  /* =========================================================
     MOBILE SIDEBAR TOGGLE
  ========================================================= */
  function initMobileSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const btnToggle = document.getElementById('btn-sidebar-toggle');

    if (!sidebar || !overlay || !btnToggle) return;

    function openSidebar() {
      sidebar.classList.add('mobile-open');
      overlay.classList.remove('hidden');
      overlay.removeAttribute('aria-hidden');
      btnToggle.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      sidebar.classList.remove('mobile-open');
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      btnToggle.setAttribute('aria-expanded', 'false');
    }

    btnToggle.addEventListener('click', () => {
      if (sidebar.classList.contains('mobile-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    return { openSidebar, closeSidebar };
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    toast,
    actionToast,      // [v9] 버튼 달린 토스트(재연결 안내)
    confirmDelete,
    confirmUnsaved,
    prompt,
    promptLink,
    openEmojiPicker,
    closeEmojiPicker,
    initEmojiPicker,
    openContextMenu,
    initTheme,
    applyTheme,
    toggleTheme,
    escapeHtml,
    generateId,
    formatDate,
    isOnline,
    isMobile,
    initSidebarResize,
    initMobileSidebar,
  };
})();
