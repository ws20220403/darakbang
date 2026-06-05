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

  function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    const grid   = document.getElementById('emoji-grid');
    const searchInput = document.getElementById('emoji-search');

    function renderEmojis(list) {
      grid.innerHTML = '';
      list.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-item';
        btn.textContent = emoji;
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-label', emoji);
        btn.addEventListener('click', () => {
          if (emojiCallback) emojiCallback(emoji);
          closeEmojiPicker();
        });
        grid.appendChild(btn);
      });
    }

    renderEmojis(EMOJIS);

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        renderEmojis(EMOJIS);
        return;
      }
      // 카테고리 키워드(한/영) 또는 이모지 자체로 검색
      const filtered = EMOJIS.filter((e, i) => e === q || emojiKeywords(i).toLowerCase().includes(q));
      renderEmojis(filtered);
    });

    // 외부 클릭 닫기
    document.addEventListener('click', (e) => {
      if (emojiPickerOpen && !picker.contains(e.target) && !e.target.closest('[data-emoji-trigger]')) {
        closeEmojiPicker();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && emojiPickerOpen) closeEmojiPicker();
    });
  }

  function openEmojiPicker(anchorEl, callback) {
    const picker = document.getElementById('emoji-picker');
    const searchInput = document.getElementById('emoji-search');

    emojiCallback = callback;
    emojiPickerOpen = true;

    // 위치 계산
    const rect = anchorEl.getBoundingClientRect();
    const pickerW = 320;
    const pickerH = 340;

    let left = rect.left;
    let top  = rect.bottom + 4;

    if (left + pickerW > window.innerWidth) {
      left = window.innerWidth - pickerW - 8;
    }
    if (top + pickerH > window.innerHeight) {
      top = rect.top - pickerH - 4;
    }

    picker.style.left = `${Math.max(8, left)}px`;
    picker.style.top  = `${Math.max(8, top)}px`;
    picker.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
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

    // options: { rename, favorite, favorited, newSubpage, delete }
    const ctxRename    = document.getElementById('ctx-rename');
    const ctxFavorite  = document.getElementById('ctx-favorite');
    const ctxNewSub    = document.getElementById('ctx-new-subpage');
    const ctxDelete    = document.getElementById('ctx-delete');

    // 즐겨찾기 텍스트 업데이트
    ctxFavorite.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="${options.favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      ${options.favorited ? '즐겨찾기 제거' : '즐겨찾기에 추가'}
    `;

    // 위치
    let left = x;
    let top  = y;
    const menuW = 180;
    const menuH = 160;
    if (left + menuW > window.innerWidth) left = x - menuW;
    if (top  + menuH > window.innerHeight) top = y - menuH;

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
    };

    const onRename   = () => { close(); options.onRename?.(); };
    const onFavorite = () => { close(); options.onFavorite?.(); };
    const onNewSub   = () => { close(); options.onNewSubpage?.(); };
    const onDelete   = () => { close(); options.onDelete?.(); };
    const onDocClick = (e) => { if (!menu.contains(e.target)) close(); };
    const onKeydown  = (e) => { if (e.key === 'Escape') close(); };

    ctxRename.addEventListener('click', onRename);
    ctxFavorite.addEventListener('click', onFavorite);
    ctxNewSub.addEventListener('click', onNewSub);
    ctxDelete.addEventListener('click', onDelete);
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
