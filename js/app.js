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
  let _autosaveTimer       = null;   // 디바운스 자동저장
  const AUTOSAVE_DELAY     = 900;    // ms — [v9] 1500→900: 저장 연동 체감 단축(요구사항 2)
  let _bodyLinks           = new Set(); // 현재 페이지 본문의 하위문서 링크 스냅샷(삭제 동기화용)
  let _reconnectBanner     = null;   // [v9] 토큰 만료 시 '다시 연결' 배너(중복 방지용)

  /* =========================================================
     자동 저장 / 저장 상태 표시
  ========================================================= */
  function _setSaveStatus(text) {
    const el = document.getElementById('save-status');
    if (el) el.textContent = text || '';
  }

  function _scheduleAutosave() {
    clearTimeout(_autosaveTimer);
    if (!Workspace.getCurrentPageId()) return;
    _autosaveTimer = setTimeout(async () => {
      if (!Workspace.isDirty()) return;
      // [v9] 토큰 재연결 대기 중에는 자동저장 보류 → '팝업 실패' 오류 반복(스팸) 방지.
      //      내용은 그대로 남고, 사용자가 '다시 연결'을 누르면 저장이 이어집니다(요구사항 4).
      if (Auth.needsReauth && Auth.needsReauth()) return;
      if (!UI.isOnline() && !Storage.isDemo()) return; // 오프라인이면 수동 저장에 맡김
      await _savePage({ silent: true, auto: true });
    }, AUTOSAVE_DELAY);
  }

  /* =========================================================
     [v9] 토큰 만료(재연결 필요) 처리 — 요구사항 4
     - 세션을 지우거나 내용을 잃지 않고, 사용자 클릭(제스처)으로 팝업을 정상적으로 열어
       토큰을 갱신한 뒤 실패했던 저장을 자동 재시도한다.
  ========================================================= */
  function _isReauthError(e) {
    if (!e) return false;
    if (e.code === 'reauth_required') return true;
    const m = String(e.message || '');
    return /popup|토큰 갱신|팝업|reauth/i.test(m);
  }

  function _promptReconnect(retryFn) {
    if (_reconnectBanner) return;   // 이미 떠 있으면 중복 표시 안 함
    _reconnectBanner = UI.actionToast(
      '구글 로그인 세션이 만료되어 저장하지 못했습니다. 작성한 내용은 그대로 있어요.',
      'warning', '다시 연결',
      async () => {
        try {
          await Auth.reconnect();
          _dismissReconnect();
          UI.toast('다시 연결됐습니다. 저장을 이어갑니다.', 'success');
          if (typeof retryFn === 'function') await retryFn();
        } catch (err) {
          console.error('재연결 실패:', err);
          UI.toast('다시 연결하지 못했습니다. 버튼을 한 번 더 눌러주세요.', 'error', 6000);
        }
      }
    );
  }

  function _dismissReconnect() {
    if (_reconnectBanner && typeof _reconnectBanner.remove === 'function') _reconnectBanner.remove();
    _reconnectBanner = null;
  }

  /* =========================================================
     앱 시작
  ========================================================= */
  async function start() {
    // 테마 초기화 (CSS 적용 전에)
    UI.initTheme();

    // GIS 초기화 (실패해도 데모 모드는 가능하므로 앱을 막지 않음)
    try {
      await Auth.init();
    } catch (e) {
      console.warn('GIS 초기화 실패 — 실로그인은 불가하지만 데모는 가능합니다:', e);
    }

    // 로그인(또는 데모) 여부 확인
    if (Auth.isLoggedIn()) {
      Storage.setMode(Auth.isDemo() ? 'demo' : 'drive');
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
        // Client ID 미설정이면 구글의 400 오류 대신 설정 모달을 열어 안내
        if (!Auth.isConfigured()) {
          UI.toast('먼저 “구글 드라이브 연결 설정”에서 Client ID를 입력해 주세요.', 'info', 5000);
          _openGoogleSetup();
          return;
        }
        btn.disabled = true;
        // "로그인 상태 유지" 선택 반영 (토큰 저장 위치 결정)
        Auth.setPersist(!!document.getElementById('chk-stay')?.checked);
        try {
          await Auth.login();
          Storage.setMode('drive');
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

    // 데모로 둘러보기 (OAuth 불필요)
    const demoBtn = document.getElementById('btn-demo-login');
    if (demoBtn && !demoBtn.dataset.listenerBound) {
      demoBtn.dataset.listenerBound = '1';
      demoBtn.addEventListener('click', async () => {
        demoBtn.disabled = true;
        Auth.enterDemo();
        Storage.setMode('demo');
        try {
          await _bootApp();
        } catch (e) {
          console.error('데모 시작 실패:', e);
          demoBtn.disabled = false;
          UI.toast('데모를 시작하지 못했습니다.', 'error');
        }
      });
    } else if (demoBtn) {
      demoBtn.disabled = false;
    }

    // "로그인 상태 유지" 체크박스 — 저장된 설정 반영
    const stay = document.getElementById('chk-stay');
    if (stay) stay.checked = Auth.getPersist();

    // 구글 드라이브 연결 설정 모달
    const setupBtn = document.getElementById('btn-google-setup');
    if (setupBtn && !setupBtn.dataset.listenerBound) {
      setupBtn.dataset.listenerBound = '1';
      setupBtn.addEventListener('click', _openGoogleSetup);
    }
  }

  /* =========================================================
     구글 연결 설정 (배포 후 코드 수정 없이 Client ID 입력)
  ========================================================= */
  function _openGoogleSetup() {
    const overlay  = document.getElementById('modal-gsetup');
    const input    = document.getElementById('gsetup-input');
    const originEl = document.getElementById('gsetup-origin');
    const btnSave  = document.getElementById('gsetup-save');
    const btnCancel = document.getElementById('gsetup-cancel');
    if (!overlay) return;

    if (originEl) originEl.textContent = window.location.origin;
    input.value = Auth.isConfigured() ? Auth.getClientId() : '';
    overlay.classList.remove('hidden');
    overlay.removeAttribute('aria-hidden');
    input.focus();
    input.select();

    const close = () => {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      btnSave.removeEventListener('click', onSave);
      btnCancel.removeEventListener('click', close);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
    };
    const onOverlay = (e) => { if (e.target === overlay) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onSave = () => {
      const id = input.value.trim();
      if (id && !id.includes('.apps.googleusercontent.com')) {
        UI.toast('형식이 올바르지 않습니다. “…apps.googleusercontent.com” 형태여야 합니다.', 'warning', 5000);
        return;
      }
      Auth.setClientId(id);
      close();
      if (Auth.isConfigured()) {
        UI.toast('저장됐습니다. 잠시 후 새로고침 → “구글 계정으로 로그인”을 눌러주세요.', 'success', 4000);
        setTimeout(() => location.reload(), 900);
      } else {
        UI.toast('연결 설정을 비웠습니다.', 'info');
      }
    };

    btnSave.addEventListener('click', onSave);
    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
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

      // 데모 모드 배지 표시
      document.getElementById('demo-badge')?.classList.toggle('hidden', !Auth.isDemo());
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) logoutBtn.title = Auth.isDemo() ? '데모 종료' : '로그아웃';

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
    History.reset(null);                 // [v6] 되돌리기 기록 비우기(메모리 정리)
    Sidebar.setActivePage(null);
  }

  /* [v6] 되돌리기/복원 버튼 활성/비활성 갱신 (History 상태 변화 시) */
  function _updateHistoryButtons(e) {
    const canUndo = e?.detail?.canUndo ?? false;
    const canRedo = e?.detail?.canRedo ?? false;
    ['btn-undo', 'btn-undo-mobile'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !canUndo; });
    ['btn-redo', 'btn-redo-mobile'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !canRedo; });
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

    // [v7] 단축키 · 편의기능 안내
    document.getElementById('btn-shortcuts')?.addEventListener('click', () => {
      if (typeof Shortcuts !== 'undefined') Shortcuts.open();
    });

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

    // [v6] 되돌리기/복원 버튼(←/→, 데스크톱·모바일)
    const bindHist = (id, fn) => document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    bindHist('btn-undo', () => History.undo());
    bindHist('btn-redo', () => History.redo());
    bindHist('btn-undo-mobile', () => History.undo());
    bindHist('btn-redo-mobile', () => History.redo());
    document.addEventListener('darakbang:historyChanged', _updateHistoryButtons);

    // [v6] Ctrl+Z 되돌리기 / Ctrl+Shift+Z·Ctrl+Y 복원
    //  - 제목·코드(textarea)·입력창은 브라우저 기본 실행취소를 그대로 둔다(세밀 편집 보존).
    //  - 본문 에디터 블록(문단/목록/표 등)과 포커스 없는 상태에선 문서 단위 되돌리기.
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const isUndo = (k === 'z' && !e.shiftKey);
      const isRedo = (k === 'z' && e.shiftKey) || (k === 'y');
      if (!isUndo && !isRedo) return;
      if (!Workspace.getCurrentPageId()) return;
      const ae = document.activeElement;
      const tag = ae && ae.tagName;
      const nativeField = tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.id === 'page-title-input');
      if (nativeField) return;
      e.preventDefault();
      if (isUndo) History.undo(); else History.redo();
    }, true);

    // 페이지 제목 입력
    const titleInput = document.getElementById('page-title-input');
    titleInput?.addEventListener('input', () => {
      Workspace.markDirty();
      const title = titleInput.textContent.trim();
      const mobileTitleEl = document.getElementById('mobile-page-title');
      if (mobileTitleEl) mobileTitleEl.textContent = title || '제목 없음';
      _updateSidebarTitle(Workspace.getCurrentPageId(), title);
      _scheduleAutosave();
    });

    // 에디터 내용 변경 → 자동 저장 예약 + (단어 수 + 본문→사이드바 즉시 동기화)
    document.addEventListener('darakbang:editorChanged', _scheduleAutosave);
    document.addEventListener('darakbang:editorChanged', _onEditorChanged);

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

    // 페이지 이동 시에는 경고 대신 자동 저장합니다. 저장 버튼 기능은 그대로 유지됩니다.
    // (현재 열린 페이지가 있을 때만. 페이지가 없는데 dirty면 저장이 실패해 이동이 막히던 버그 방지)
    if (Workspace.isDirty() && Workspace.getCurrentPageId()) {
      const saved = await _savePage({ silent: true });
      if (!saved) return;
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
      // [v9b] '이모지 없음'(빈 문자열)을 그대로 보존 — || 가 아니라 ?? 사용
      iconDisplay.textContent = pageData.icon ?? '📄';
    }

    // 모바일 타이틀
    const mobileTitleEl = document.getElementById('mobile-page-title');
    if (mobileTitleEl) {
      mobileTitleEl.textContent = pageData.title || '제목 없음';
    }

    // 커버 이미지 상태 초기화
    const isSubPage = !!pageData.parentId;
    _currentCoverImageId = isSubPage ? null : (pageData.coverImageId || null);
    await _renderCover(_currentCoverImageId);

    // 커버 추가 버튼 (커버 없을 때만 표시)
    const btnAddCover = document.getElementById('btn-add-cover');
    if (btnAddCover) {
      btnAddCover.classList.toggle('hidden', isSubPage || !!_currentCoverImageId);
    }

    // 브레드크럼
    _renderBreadcrumb(pageData.id);

    // 에디터 초기화
    EditorManager.init(pageData);
    Workspace.markClean();

    // [v6] 되돌리기/복원 기록 초기화 — 로드한 본문을 첫 스냅샷으로(에디터 준비와 무관하게 즉시)
    History.reset(pageData.editorData);

    // 본문 링크 스냅샷 초기화(로드 시점) — 이후 '이번에 지운' 링크만 트리에서 제거
    _bodyLinks = _bodyLinkSet(pageData.editorData);
  }

  /* =========================================================
     커버 이미지
  ========================================================= */
  async function _renderCover(fileId) {
    const coverEl   = document.getElementById('page-cover');
    const coverImg  = document.getElementById('page-cover-img');
    const contentEl = document.getElementById('page-content');
    if (!coverEl || !coverImg) return;
    const setHasCover = (on) => contentEl?.classList.toggle('has-cover', !!on);

    if (!fileId) {
      coverEl.classList.add('hidden');
      setHasCover(false);
      return;
    }

    try {
      const blobUrl = await EditorManager.loadCoverImage(fileId);
      if (blobUrl) {
        coverImg.src = blobUrl;
        coverEl.classList.remove('hidden');
        setHasCover(true);   // [v9b] Notion식 슬림 배너 — 높이는 CSS 고정(object-fit:cover), JS 높이계산 제거
      } else {
        coverEl.classList.add('hidden');
        setHasCover(false);
      }
    } catch (e) {
      console.warn('커버 이미지 로드 실패:', e);
      coverEl.classList.add('hidden');
      setHasCover(false);
    }
  }
  // [v9b] _fitCoverToImage 제거: 커버 높이는 CSS 고정(슬림 배너)으로 처리. 창 resize 리스너도 불필요.

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
      const { fileId } = await Storage.uploadImage(file);
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
      span.innerHTML = `<span class="breadcrumb-icon">${meta.icon ?? '📄'}</span><span class="breadcrumb-text">${UI.escapeHtml(meta.title || '제목 없음')}</span>`;
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
      span.innerHTML = `<span class="breadcrumb-icon">${current.icon ?? '📄'}</span><span class="breadcrumb-text">${UI.escapeHtml(current.title || '제목 없음')}</span>`;
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

    if (!UI.isOnline() && !Storage.isDemo()) {
      UI.toast('인터넷 연결이 필요합니다. 연결 후 저장해주세요.', 'warning', 5000);
      return false;
    }

    const titleInput = document.getElementById('page-title-input');
    const title = titleInput?.textContent?.trim() || '제목 없음';
    // [v9b] '이모지 없음'(빈 문자열)을 보존 — 비어 있으면 빈 채로 저장(|| '📄' 금지)
    const iconRaw = document.getElementById('page-icon-display')?.textContent;
    const icon  = (iconRaw == null ? '📄' : iconRaw.trim());

    // 저장 버튼 비활성화 (중복 방지)
    const btnSave       = document.getElementById('btn-save');
    const btnSaveMobile = document.getElementById('btn-save-mobile');
    if (btnSave)       btnSave.disabled = true;
    if (btnSaveMobile) btnSaveMobile.disabled = true;

    try {
      const editorData = await EditorManager.getEditorData();
      // 에디터가 아직 준비 안 됨(null) → 저장할 사용자 내용이 없음. 빈 데이터로 덮어쓰지 말고
      // 깔끔히 종료(이동 허용). 데이터 손실/무한 멈춤 방지.
      if (!editorData) {
        Workspace.markClean();
        return true;
      }
      // 자동/조용한 저장(이동·자동저장)은 충돌검사 읽기를 생략해 속도 ↑. 명시적 저장은 검사 유지.
      const saved = await Workspace.savePage(pageId, editorData, title, icon, _currentCoverImageId, { skipConflictCheck: !!options.silent });

      if (saved) {
        if (!options.silent) UI.toast('저장됐습니다.', 'success');
        const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        _setSaveStatus(`저장됨 · ${t}`);
        // [v8] 조용한 자동저장에선 사이드바/브레드크럼 전체 재렌더 생략 — 제목은 입력 시 즉시 동기화되고,
        //      구조 변경(하위문서 추가/삭제/순서)은 각자 경로에서 이미 렌더하므로 입력 중 불필요한 부하만 줄임.
        if (!options.silent) {
          Sidebar.render();
          _renderBreadcrumb(pageId);
        }
        const mobileTitleEl = document.getElementById('mobile-page-title');
        if (mobileTitleEl) mobileTitleEl.textContent = title;
      }

      return saved;
    } catch (e) {
      console.error('저장 실패:', e);
      // [v9] 토큰 만료(팝업 실패 등)면 오류 토스트 대신 '다시 연결' 안내 + 저장 자동 재시도(요구사항 4)
      if (_isReauthError(e)) {
        _promptReconnect(() => _savePage(options));
      } else {
        UI.toast(`저장에 실패했습니다: ${e.message}`, 'error');
      }
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
    if (!UI.isOnline() && !Storage.isDemo()) {
      UI.toast('새 페이지를 만들려면 인터넷 연결이 필요합니다.', 'warning');
      return null;
    }

    try {
      const result = await Workspace.createPage(parentId);
      if (!result) return null;

      // [v3] 하위 페이지를 만들면 부모 본문 맨 아래에 '하위 문서' 링크 블록을 추가
      if (parentId) {
        await _addChildLinkToParent(parentId, result.meta.id);
      }

      Sidebar.render();
      await navigateToPage(result.meta.id);

      // 제목 필드에 포커스 및 커서 위치 — [v9] 300ms 고정 지연 제거, 다음 프레임에 즉시 포커스(요구사항 1)
      const focusTitle = () => {
        const titleInput = document.getElementById('page-title-input');
        if (!titleInput) return;
        titleInput.focus();
        const range = document.createRange();
        const sel   = window.getSelection();
        range.selectNodeContents(titleInput);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      };
      requestAnimationFrame(focusTitle);

      return result;
    } catch (e) {
      console.error('페이지 생성 실패:', e);
      UI.toast('페이지를 만드는 데 실패했습니다.', 'error');
      return null;
    }
  }

  /* =========================================================
     부모 본문 ↔ 하위문서 링크 연결 (요구사항 1)
     - 부모가 현재 열려있으면: 라이브 에디터 맨 끝에 블록 삽입 → 페이지 이동 시 자동 저장
     - 부모가 닫혀있으면: 저장된 본문(JSON)에 직접 추가
  ========================================================= */
  async function _addChildLinkToParent(parentId, childId) {
    const ed = EditorManager.instance;
    if (parentId === Workspace.getCurrentPageId() && ed) {
      try {
        await ed.isReady;
        const count = ed.blocks.getBlocksCount();
        ed.blocks.insert('pageLink', { pageId: childId }, {}, count, false);
        Workspace.markDirty();   // navigateToPage 가 부모를 자동 저장
        return;
      } catch (e) {
        console.warn('라이브 에디터 링크 삽입 실패 → 저장본에 직접 추가:', e);
      }
    }
    await Workspace.appendChildLink(parentId, childId);
  }

  /* 자식 삭제 시 부모 본문의 죽은 링크 제거 */
  async function removeChildLinkFromParent(parentId, childId) {
    const ed = EditorManager.instance;
    if (parentId === Workspace.getCurrentPageId() && ed) {
      try {
        await ed.isReady;
        const out = await ed.save();
        const indices = [];
        (out.blocks || []).forEach((b, i) => {
          if (b.type === 'pageLink' && b.data && b.data.pageId === childId) indices.push(i);
        });
        indices.sort((a, b) => b - a).forEach(i => { try { ed.blocks.delete(i); } catch {} });
        if (indices.length) Workspace.markDirty();
        return;
      } catch (e) {
        console.warn('라이브 에디터 링크 제거 실패 → 저장본에서 제거:', e);
      }
    }
    await Workspace.removeChildLink(parentId, childId);
  }

  /* =========================================================
     페이지 복제 (요구사항 5)
  ========================================================= */
  async function duplicatePage(pageId) {
    // 현재 보고 있는 페이지를 복제할 때 미저장분이 반영되도록 먼저 저장
    if (pageId === Workspace.getCurrentPageId() && Workspace.isDirty()) {
      await _savePage({ silent: true });
    }
    try {
      const result = await Workspace.duplicatePage(pageId);
      if (!result) { UI.toast('복제할 수 없습니다.', 'error'); return null; }
      // 하위 페이지 복제면 부모 본문 맨 아래에 링크를 추가해 사이드바/본문 일치 (요구사항 1·2)
      if (result.meta.parentId) {
        await _addChildLinkToParent(result.meta.parentId, result.meta.id);
      }
      Sidebar.render();
      await navigateToPage(result.meta.id);
      UI.toast('페이지를 복제했습니다.', 'success');
      return result;
    } catch (e) {
      console.error('복제 실패:', e);
      UI.toast('복제에 실패했습니다.', 'error');
      return null;
    }
  }

  /* =========================================================
     내보내기 (요구사항 5) — Markdown / 전체 백업(JSON)
  ========================================================= */
  function _downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function _safeFileName(name) {
    return (name || '제목 없음').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80).trim() || 'page';
  }

  async function exportPageMarkdown(pageId) {
    try {
      const data = await Workspace.loadPage(pageId);
      const meta = Workspace.getPageMeta(pageId);
      const title = (meta?.title || data?.title || '제목 없음');
      const md = Exporter.toMarkdown(title, data?.editorData);
      _downloadFile(_safeFileName(title) + '.md', md, 'text/markdown;charset=utf-8');
      UI.toast('Markdown 파일로 내보냈습니다.', 'success');
    } catch (e) {
      console.error('Markdown 내보내기 실패:', e);
      UI.toast('내보내기에 실패했습니다.', 'error');
    }
  }

  async function exportFullBackup() {
    const toastEl = UI.toast('전체 백업을 준비하는 중...', 'info', 60000);
    try {
      const metas = Workspace.getAllPagesMeta();
      const pages = {};
      for (const m of metas) {
        try { pages[m.id] = await Workspace.loadPage(m.id); }
        catch (e) { console.warn('백업: 페이지 로드 실패', m.id, e); }
      }
      const backup = {
        app: 'darakbang',
        backupVersion: 3,
        exportedAt: new Date().toISOString(),
        workspace: Workspace.workspace,
        settings: Workspace.settings,
        pages,
      };
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      _downloadFile(`다락방_백업_${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      toastEl?.remove();
      UI.toast('전체 백업(JSON)을 내려받았습니다.', 'success');
    } catch (e) {
      console.error('전체 백업 실패:', e);
      toastEl?.remove();
      UI.toast('백업에 실패했습니다.', 'error');
    }
  }

  /* =========================================================
     에디터 변경 시: 되돌리기 기록 + 본문→사이드바 즉시 순서 동기화
     (한 번의 save() 결과를 공유해 중복 직렬화를 피함)
  ========================================================= */
  async function _onEditorChanged(e) {
    const pageId = Workspace.getCurrentPageId();
    if (!pageId) return;
    const fromHistory = !!(e && e.detail && e.detail.fromHistory);   // [v6] 되돌리기/복원發 변경인지
    let data;
    try { data = await EditorManager.getEditorData(); } catch { return; }
    // 빠른 페이지 전환 중 늦게 도착한 콜백이 다른 페이지 데이터를 덮어쓰지 않도록 가드
    if (Workspace.getCurrentPageId() !== pageId) return;
    // null(미준비)/빈 데이터(블록 0개)는 무시 — 전환·파괴 레이스에서 children 을 잘못 지우지 않도록 안전장치
    if (!data || !data.blocks || data.blocks.length === 0) return;

    if (fromHistory) {
      // [v6] 되돌리기/복원으로 인한 변경일 땐 하위문서 '삭제 동기화'와 '재기록'을 건너뜀
      //      (오삭제 방지 + 복원 가지 보존). 링크 스냅샷만 갱신해 이후 편집의 오삭제를 막는다.
      _bodyLinks = _bodyLinkSet(data);
    } else {
      // 본문에서 하위문서 링크를 지웠으면 사이드바(좌측 탭)에서도 제거 (요구사항 2)
      try { await _reconcileChildrenWithBody(pageId, data); } catch {}
      // [v6] 되돌리기/복원용 스냅샷 기록(유휴 시점 묶음 단위). 중복은 내부에서 무시.
      try { History.record(data); } catch {}
    }

    // 본문에서 하위문서 순서가 바뀌면 자동저장(1.5s)을 기다리지 않고 사이드바 즉시 반영
    try { if (Workspace.syncChildrenOrderLive(pageId, data)) Sidebar.render(); } catch {}
  }

  /* 본문 pageLink 의 pageId 집합 */
  function _bodyLinkSet(editorData) {
    const s = new Set();
    const blocks = (editorData && Array.isArray(editorData.blocks)) ? editorData.blocks : [];
    for (const b of blocks) if (b && b.type === 'pageLink' && b.data && b.data.pageId) s.add(b.data.pageId);
    return s;
  }

  /* 본문의 하위문서(pageLink) 링크를 '이번에' 지웠으면, 해당 하위 페이지를 트리에서도 제거.
     - 로드 시점 스냅샷(_bodyLinks)과 비교해, 원래 링크가 있던 것이 사라진 경우만 삭제
       → 예전 데이터(원래 링크 없던 자식)는 건드리지 않음(오삭제 방지).
     - 구글 모드는 드라이브 휴지통으로 안전 삭제(복구 가능). 루트/하위 모두 동일. */
  async function _reconcileChildrenWithBody(pageId, data) {
    const meta = Workspace.getPageMeta(pageId);
    if (!meta || !Array.isArray(meta.children)) { _bodyLinks = _bodyLinkSet(data); return false; }

    const curr = _bodyLinkSet(data);
    const removed = meta.children.filter(id =>
      _bodyLinks.has(id) && !curr.has(id) && Workspace.getPageMeta(id)
    );
    _bodyLinks = curr;   // 스냅샷 갱신(추가/삭제 모두 추적)

    if (!removed.length) return false;
    for (const childId of removed) {
      try { await Workspace.deletePage(childId); } catch (e) { console.warn('하위문서 동기 삭제 실패:', e); }
    }
    Sidebar.render();
    UI.toast(`하위 문서 ${removed.length}개를 본문과 함께 삭제했습니다.` + (Storage.isDemo() ? '' : ' (드라이브 휴지통에서 복구 가능)'), 'info', 4500);
    return true;
  }

  /* =========================================================
     하위 페이지(형제) 순서 변경 (요구사항 3 — 사이드바 → 본문 양방향)
  ========================================================= */
  async function reorderChildren(parentId, newOrder) {
    const meta = Workspace.getPageMeta(parentId);
    if (!meta) return;
    meta.children = newOrder.slice();   // children 즉시 반영
    Sidebar.render();                    // 사이드바 즉시 갱신(체감 속도)

    if (parentId === Workspace.getCurrentPageId() && EditorManager.instance) {
      // 부모가 열려 있으면: 라이브 에디터의 링크 순서를 맞추고 즉시 저장
      await EditorManager.reorderPageLinks(newOrder);
      Workspace.markDirty();
      await _savePage({ silent: true });
    } else {
      // 부모가 닫혀 있으면: 저장본 본문 링크 재배치 + 저장
      await Workspace.reorderChildrenStored(parentId, newOrder);
    }
  }

  /* 형제 중 위로(-1)/아래로(+1) 한 칸 이동 */
  async function moveChildPage(childId, direction) {
    const meta = Workspace.getPageMeta(childId);
    if (!meta || !meta.parentId) return false;
    const ids = Workspace.getChildrenIds(meta.parentId);
    const idx = ids.indexOf(childId);
    const target = idx + (direction < 0 ? -1 : 1);
    if (idx === -1 || target < 0 || target >= ids.length) return false;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    await reorderChildren(meta.parentId, ids);
    return true;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    start,
    navigateToPage,
    createNewPage,
    removeChildLinkFromParent,
    reorderChildren,
    moveChildPage,
    duplicatePage,
    exportPageMarkdown,
    exportFullBackup,
    showWelcome,
  };
})();

/* =========================================================
   앱 시작
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  App.start();
});
