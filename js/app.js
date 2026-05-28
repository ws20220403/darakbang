/**
 * app.js — 앱 진입점 및 주요 흐름 조율
 *
 * 실행 순서:
 * 1. Google OAuth 초기화
 * 2. 로그인 여부 확인
 *    - 로그인: Drive 초기화 → 앱 화면
 *    - 미로그인: 로그인 화면
 * 3. 페이지 탐색, 저장, 커버 이미지 관리
 */

const App = (() => {

  let _currentCoverImageId = null;
  let _globalEventsBound   = false;  // 중복 바인딩 방지
  let _coverResizeHandler  = null;

  /* =========================================================
     앱 시작
  ========================================================= */
  async function start() {
    // 테마 초기화 (CSS 적용 전에)
    UI.initTheme();

    // GIS 초기화
    try {
      await Auth.init();
    } catch (e) {
      console.error('GIS 초기화 실패:', e);
      _showError('Google 인증 서비스를 불러오는 데 실패했습니다. 페이지를 새로고침 해주세요.');
      return;
    }

    // 로그인 여부 확인
    if (Auth.isLoggedIn()) {
      await _bootApp();
    } else {
      _showLoginScreen();
    }
  }

  /* =========================================================
     로그인 화면
  ========================================================= */
  function _showLoginScreen() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.add('hidden');

    // [버그수정] { once: true } 제거 → 로그아웃 후 재로그인 시에도 작동
    // 대신 data 속성으로 중복 바인딩 방지
    const btn = document.getElementById('btn-google-login');
    if (btn && !btn.dataset.listenerBound) {
      btn.dataset.listenerBound = '1';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await Auth.login();
          await _bootApp();
        } catch (e) {
          console.error('로그인 실패:', e);
          btn.disabled = false;
          if (e.message?.includes('popup_closed') || e.message?.includes('popup_failed') || e.message?.includes('user_cancelled')) {
            UI.toast('로그인 창이 닫혔습니다. 다시 시도해주세요.', 'warning');
          } else {
            UI.toast('로그인에 실패했습니다. 다시 시도해주세요.', 'error');
          }
        }
      });
    } else if (btn) {
      // 로그아웃 후 재방문 시 버튼 다시 활성화
      btn.disabled = false;
    }
  }

  /* =========================================================
     앱 부팅 (로그인 후)
  ========================================================= */
  async function _bootApp() {
    _showLoading('다락방을 열고 있습니다...');

    try {
      // Drive 폴더 구조 + 워크스페이스 초기화
      await Workspace.init();

      // 사용자 정보 로드
      const user = await Auth.fetchUserInfo();
      _updateUserProfile(user);

      // 앱 화면 전환
      _showApp();

      // UI 초기화 (한 번만)
      UI.initEmojiPicker();
      UI.initSidebarResize();
      const mobileSidebar = UI.initMobileSidebar();

      // 사이드바 초기화
      Sidebar.init();

      // 전역 이벤트 바인딩 (중복 방지)
      if (!_globalEventsBound) {
        _bindGlobalEvents(mobileSidebar);
        _globalEventsBound = true;
      }

      // 웰컴 화면
      showWelcome();

    } catch (e) {
      console.error('앱 초기화 실패:', e);
      const msg = e.message || '';
      if (msg.includes('401') || msg.includes('토큰') || msg.includes('token') || msg.includes('unauthorized')) {
        Auth.clearTokens();
        _showLoginScreen();
        UI.toast('세션이 만료됐습니다. 다시 로그인해주세요.', 'warning');
      } else {
        _showLoginScreen();
        UI.toast(`앱 초기화 실패: ${e.message}`, 'error', 8000);
      }
    }
  }

  /* =========================================================
     사용자 프로필 업데이트
  ========================================================= */
  function _updateUserProfile(user) {
    const avatar = document.getElementById('user-avatar');
    const name   = document.getElementById('user-name');
    const email  = document.getElementById('user-email');

    if (avatar) {
      if (user.picture) {
        avatar.src = user.picture;
        avatar.style.display = '';
      } else {
        avatar.style.display = 'none';
      }
      avatar.onerror = () => { avatar.style.display = 'none'; };
    }
    if (name)  name.textContent  = user.name  || '사용자';
    if (email) email.textContent = user.email || '';
  }

  /* =========================================================
     화면 전환 헬퍼
  ========================================================= */
  function _showLoading(msg = '') {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('loading-screen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    const msgEl = document.getElementById('loading-message');
    if (msgEl && msg) msgEl.textContent = msg;
  }

  function _showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
  }

  function _showError(msg) {
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    UI.toast(msg, 'error', 8000);
  }

  function showWelcome() {
    document.getElementById('welcome-screen')?.classList.remove('hidden');
    document.getElementById('page-editor-area')?.classList.add('hidden');
    Workspace.setCurrentPageId(null);
    EditorManager.destroy();
    const mobileTitleEl = document.getElementById('mobile-page-title');
    if (mobileTitleEl) mobileTitleEl.textContent = '다락방';
    Sidebar.setActivePage(null);
  }

  /* =========================================================
     전역 이벤트
  ========================================================= */
  function _bindGlobalEvents(mobileSidebar) {
    // 로그아웃
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      if (Workspace.isDirty()) {
        const action = await UI.confirmUnsaved();
        if (action === 'save') await _savePage();
        else if (action === null) return; // 취소
      }
      Auth.logout();
      Workspace.markClean();
      EditorManager.destroy();
      _showLoginScreen();
    });

    // 테마 토글
    document.getElementById('btn-theme-toggle')?.addEventListener('click', UI.toggleTheme);

    // 저장 버튼
    document.getElementById('btn-save')?.addEventListener('click', _savePage);
    document.getElementById('btn-save-mobile')?.addEventListener('click', _savePage);

    // Ctrl+S / Cmd+S
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        _savePage();
      }
    });

    // 페이지 제목 입력
    const titleInput = document.getElementById('page-title-input');
    titleInput?.addEventListener('input', () => {
      Workspace.markDirty();
      const title = titleInput.textContent.trim();
      const mobileTitleEl = document.getElementById('mobile-page-title');
      if (mobileTitleEl) mobileTitleEl.textContent = title || '제목 없음';
      _updateSidebarTitle(Workspace.getCurrentPageId(), title);
    });

    // 엔터 키로 에디터 포커스 이동
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Editor.js 첫 번째 contenteditable로 포커스
        const editorEl = document.getElementById('editorjs');
        const firstEditable = editorEl?.querySelector('[contenteditable="true"]');
        if (firstEditable) firstEditable.focus();
      }
    });

    // 제목 붙여넣기 시 plain text만 허용
    titleInput?.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text.replace(/[\r\n]+/g, ' '));
    });

    // 페이지 아이콘 버튼
    document.getElementById('btn-page-icon')?.addEventListener('click', (e) => {
      e.currentTarget.setAttribute('data-emoji-trigger', '');
      UI.openEmojiPicker(e.currentTarget, (emoji) => {
        document.getElementById('page-icon-display').textContent = emoji;
        Workspace.markDirty();
      });
    });

    // 커버 이미지 버튼들
    document.getElementById('btn-add-cover')?.addEventListener('click', _triggerCoverUpload);
    document.getElementById('btn-change-cover')?.addEventListener('click', _triggerCoverUpload);
    document.getElementById('btn-remove-cover')?.addEventListener('click', _removeCover);
    document.getElementById('cover-file-input')?.addEventListener('change', _onCoverFileChange);

    // 탭 닫기 경고 (미저장 시)
    window.addEventListener('beforeunload', (e) => {
      if (Workspace.isDirty()) {
        e.preventDefault();
        e.returnValue = '저장되지 않은 내용이 있습니다.';
      }
    });

    // 네트워크 상태
    window.addEventListener('online',  () => UI.toast('인터넷에 연결됐습니다.', 'success'));
    window.addEventListener('offline', () => UI.toast('인터넷 연결이 끊어졌습니다. 저장이 불가능합니다.', 'warning', 5000));

    // 모바일: 페이지 이동 시 사이드바 닫기
    if (mobileSidebar) {
      document.addEventListener('darakbang:pageChanged', () => {
        if (UI.isMobile()) mobileSidebar.closeSidebar();
      });
    }
  }

  /* =========================================================
     페이지 탐색
  ========================================================= */
  async function navigateToPage(pageId, options = {}) {
    if (!pageId) return;
    if (pageId === Workspace.getCurrentPageId()) return;

    // 미저장 확인
    if (Workspace.isDirty()) {
      if (options.withinPage) {
        const saved = await _savePage({ silent: true });
        if (!saved) return;
      } else {
        const action = await UI.confirmUnsaved();
        if (action === 'save') {
          const saved = await _savePage();
          if (!saved) return;
        } else if (action === null) {
          return; // 취소
        }
      }
      Workspace.markClean();
    }

    // 임시 로딩 상태
    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('page-editor-area')?.classList.add('hidden');

    try {
      const pageData = await Workspace.loadPage(pageId);
      if (!pageData) {
        UI.toast('페이지 데이터를 찾을 수 없습니다.', 'error');
        showWelcome();
        return;
      }
      await _renderPage(pageData);
      Workspace.setCurrentPageId(pageId);
      Sidebar.setActivePage(pageId);
      document.dispatchEvent(new Event('darakbang:pageChanged'));
    } catch (e) {
      console.error('페이지 로드 실패:', e);
      UI.toast('페이지를 불러오는 데 실패했습니다.', 'error');
      showWelcome();
    }
  }

  /* =========================================================
     페이지 렌더링
  ========================================================= */
  async function _renderPage(pageData) {
    const editorArea = document.getElementById('page-editor-area');
    editorArea.classList.remove('hidden');
    document.getElementById('welcome-screen')?.classList.add('hidden');

    // 제목
    const titleInput = document.getElementById('page-title-input');
    if (titleInput) {
      titleInput.textContent = pageData.title || '';
    }

    // 아이콘
    const iconDisplay = document.getElementById('page-icon-display');
    if (iconDisplay) {
      iconDisplay.textContent = pageData.icon || '📄';
    }

    // 모바일 타이틀
    const mobileTitleEl = document.getElementById('mobile-page-title');
    if (mobileTitleEl) {
      mobileTitleEl.textContent = pageData.title || '제목 없음';
    }

    // 커버 이미지 상태 초기화
    _currentCoverImageId = pageData.coverImageId || null;
    await _renderCover(_currentCoverImageId);

    // 커버 추가 버튼 (커버 없을 때만 표시)
    const btnAddCover = document.getElementById('btn-add-cover');
    if (btnAddCover) {
      btnAddCover.classList.toggle('hidden', !!_currentCoverImageId);
    }

    // 브레드크럼
    _renderBreadcrumb(pageData.id);

    // 에디터 초기화
    EditorManager.init(pageData);
    Workspace.markClean();
  }

  /* =========================================================
     커버 이미지
  ========================================================= */
  async function _renderCover(fileId) {
    const coverEl  = document.getElementById('page-cover');
    const coverImg = document.getElementById('page-cover-img');
    if (!coverEl || !coverImg) return;

    if (!fileId) {
      coverEl.classList.add('hidden');
      return;
    }

    try {
      const blobUrl = await EditorManager.loadCoverImage(fileId);
      if (blobUrl) {
        coverImg.src = blobUrl;
        _fitCoverToImage(coverEl, coverImg);
        coverEl.classList.remove('hidden');
      } else {
        coverEl.classList.add('hidden');
      }
    } catch (e) {
      console.warn('커버 이미지 로드 실패:', e);
      coverEl.classList.add('hidden');
    }
  }

  function _fitCoverToImage(coverEl, coverImg) {
    const update = () => {
      const width = coverEl.clientWidth || 0;
      if (!width || !coverImg.naturalWidth || !coverImg.naturalHeight) return;
      const naturalHeight = width * (coverImg.naturalHeight / coverImg.naturalWidth);
      const maxHeight = width * (4 / 6);
      coverEl.style.setProperty('--cover-height', `${Math.min(naturalHeight, maxHeight)}px`);
    };

    coverImg.onload = update;
    if (_coverResizeHandler) window.removeEventListener('resize', _coverResizeHandler);
    _coverResizeHandler = update;
    window.addEventListener('resize', _coverResizeHandler);
    requestAnimationFrame(update);
  }

  function _triggerCoverUpload() {
    document.getElementById('cover-file-input')?.click();
  }

  async function _onCoverFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      UI.toast('파일이 10MB를 초과합니다.', 'warning');
      e.target.value = '';
      return;
    }

    const toastEl = UI.toast('커버 이미지를 업로드 중입니다...', 'info', 30000);
    try {
      const { fileId } = await Drive.uploadImage(file);
      _currentCoverImageId = fileId;
      await _renderCover(fileId);
      document.getElementById('btn-add-cover')?.classList.add('hidden');
      Workspace.markDirty();
      toastEl?.remove();
      UI.toast('커버 이미지가 설정됐습니다.', 'success');
    } catch (err) {
      console.error('커버 업로드 실패:', err);
      toastEl?.remove();
      UI.toast('커버 이미지 업로드에 실패했습니다.', 'error');
    }

    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  }

  function _removeCover() {
    _currentCoverImageId = null;
    document.getElementById('page-cover')?.classList.add('hidden');
    document.getElementById('btn-add-cover')?.classList.remove('hidden');
    Workspace.markDirty();
    UI.toast('커버 이미지가 제거됐습니다.', 'info');
  }

  /* =========================================================
     브레드크럼
  ========================================================= */
  function _renderBreadcrumb(pageId) {
    const nav = document.getElementById('breadcrumb');
    if (!nav) return;

    const ancestors = Workspace.getAncestors(pageId);
    const current   = Workspace.getPageMeta(pageId);
    nav.innerHTML = '';

    ancestors.forEach((meta) => {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item';
      span.innerHTML = `<span class="breadcrumb-icon">${meta.icon || '📄'}</span>${UI.escapeHtml(meta.title || '제목 없음')}`;
      span.addEventListener('click', () => navigateToPage(meta.id));
      nav.appendChild(span);

      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '/';
      nav.appendChild(sep);
    });

    if (current) {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item breadcrumb-item-current';
      span.setAttribute('aria-current', 'page');
      span.innerHTML = `<span class="breadcrumb-icon">${current.icon || '📄'}</span>${UI.escapeHtml(current.title || '제목 없음')}`;
      nav.appendChild(span);
    }
  }

  /* =========================================================
     사이드바 제목 실시간 업데이트
  ========================================================= */
  function _updateSidebarTitle(pageId, title) {
    if (!pageId) return;
    document.querySelectorAll(`[data-page-id="${pageId}"] .nav-item-title`).forEach(el => {
      el.textContent = title || '제목 없음';
    });
  }

  /* =========================================================
     페이지 저장
  ========================================================= */
  async function _savePage(options = {}) {
    const pageId = Workspace.getCurrentPageId();
    if (!pageId) return false;

    if (!UI.isOnline()) {
      UI.toast('인터넷 연결이 필요합니다. 연결 후 저장해주세요.', 'warning', 5000);
      return false;
    }

    const titleInput = document.getElementById('page-title-input');
    const title = titleInput?.textContent?.trim() || '제목 없음';
    const icon  = document.getElementById('page-icon-display')?.textContent?.trim() || '📄';

    // 저장 버튼 비활성화 (중복 방지)
    const btnSave       = document.getElementById('btn-save');
    const btnSaveMobile = document.getElementById('btn-save-mobile');
    if (btnSave)       btnSave.disabled = true;
    if (btnSaveMobile) btnSaveMobile.disabled = true;

    try {
      const editorData = await EditorManager.getEditorData();
      const saved = await Workspace.savePage(pageId, editorData, title, icon, _currentCoverImageId);

      if (saved) {
        if (!options.silent) UI.toast('저장됐습니다.', 'success');
        Sidebar.render();
        _renderBreadcrumb(pageId);
        const mobileTitleEl = document.getElementById('mobile-page-title');
        if (mobileTitleEl) mobileTitleEl.textContent = title;
      }

      return saved;
    } catch (e) {
      console.error('저장 실패:', e);
      UI.toast(`저장에 실패했습니다: ${e.message}`, 'error');
      return false;
    } finally {
      if (btnSave)       btnSave.disabled = false;
      if (btnSaveMobile) btnSaveMobile.disabled = false;
    }
  }

  /* =========================================================
     새 페이지 생성
  ========================================================= */
  async function createNewPage(parentId = null) {
    if (!UI.isOnline()) {
      UI.toast('새 페이지를 만들려면 인터넷 연결이 필요합니다.', 'warning');
      return null;
    }

    try {
      const result = await Workspace.createPage(parentId);
      if (!result) return null;

      Sidebar.render();
      await navigateToPage(result.meta.id);

      // 제목 필드에 포커스 및 커서 위치
      setTimeout(() => {
        const titleInput = document.getElementById('page-title-input');
        if (!titleInput) return;
        titleInput.focus();
        const range = document.createRange();
        const sel   = window.getSelection();
        range.selectNodeContents(titleInput);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 300);

      return result;
    } catch (e) {
      console.error('페이지 생성 실패:', e);
      UI.toast('페이지를 만드는 데 실패했습니다.', 'error');
      return null;
    }
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    start,
    navigateToPage,
    createNewPage,
    showWelcome,
  };
})();

/* =========================================================
   앱 시작
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  App.start();
});
