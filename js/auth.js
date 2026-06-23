/**
 * auth.js — Google OAuth 2.0 인증
 * Google Identity Services (GIS) 기반
 * access_token → localStorage 저장
 */

const Auth = (() => {

  // Client ID는 두 가지 방법으로 설정할 수 있습니다.
  //  (1) 코드: 아래 DEFAULT_CLIENT_ID 교체
  //  (2) 배포 후 앱 화면: 로그인 화면 "구글 드라이브 연결 설정"에서 입력(localStorage 저장, 우선 적용)
  const DEFAULT_CLIENT_ID = '1055434776065-64gj8snigehdl2krfjprnr6p4lo7k91u.apps.googleusercontent.com';
  const STORAGE_KEY_CLIENT = 'darakbang_client_id';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  function getClientId() {
    return (localStorage.getItem(STORAGE_KEY_CLIENT) || DEFAULT_CLIENT_ID).trim();
  }
  function setClientId(id) {
    if (id && id.trim()) localStorage.setItem(STORAGE_KEY_CLIENT, id.trim());
    else localStorage.removeItem(STORAGE_KEY_CLIENT);
  }
  function isConfigured() {
    const id = getClientId();
    return !!id && !id.startsWith('YOUR_GOOGLE_CLIENT_ID') && id.includes('.apps.googleusercontent.com');
  }

  const STORAGE_KEY_TOKEN    = 'darakbang_token';
  const STORAGE_KEY_EXPIRES  = 'darakbang_token_expires';
  const STORAGE_KEY_USER     = 'darakbang_user';

  let tokenClient = null;
  let _tokenRefreshPromise = null;
  let _needsReauth   = false;   // [v9] 조용한 갱신이 실패해 사용자 재연결이 필요한 상태
  let _proactiveTimer = null;   // [v9] 만료 전 선제 갱신 타이머
  let _visBound      = false;   // [v9] visibilitychange 1회 바인딩 가드

  /* =========================================================
     초기화
  ========================================================= */
  function init() {
    return new Promise((resolve, reject) => {
      // GIS 라이브러리 로드 대기
      const waitForGis = (retries = 0) => {
        if (window.google && window.google.accounts) {
          _initTokenClient(resolve, reject);
        } else if (retries < 30) {
          setTimeout(() => waitForGis(retries + 1), 200);
        } else {
          reject(new Error('Google Identity Services 로드 실패'));
        }
      };
      waitForGis();
    });
  }

  function _initTokenClient(resolve, reject) {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            console.error('OAuth Error:', response.error);
            _resolveTokenCallbacks?.(null, response.error);
            return;
          }
          const expiresAt = Date.now() + (response.expires_in - 60) * 1000;
          const store = _store();
          store.setItem(STORAGE_KEY_TOKEN,   response.access_token);
          store.setItem(STORAGE_KEY_EXPIRES, String(expiresAt));
          _needsReauth = false;                 // [v9] 갱신 성공 → 재연결 필요 상태 해제
          _scheduleProactiveRefresh(expiresAt); // [v9] 만료 전 선제 갱신 예약
          _resolveTokenCallbacks?.(response.access_token, null);
        },
        error_callback: (err) => {
          console.error('OAuth error_callback:', err);
          _resolveTokenCallbacks?.(null, err);
        },
      });
      _bindVisibilityRefresh();   // [v9] 탭 복귀 시 만료 임박 토큰 선제 갱신
      resolve();
    } catch (e) {
      reject(e);
    }
  }

  /* =========================================================
     [v9] 만료 전 '조용한' 선제 갱신 — '팝업 열기 실패' 오류의 발생 빈도 자체를 줄임.
       구글 세션이 살아 있으면 iframe 으로 조용히 갱신되어 토큰이 만료 상태로 방치되지 않는다.
       조용히 실패하면(세션 재동의 필요 등) 그냥 두고, 저장 시점에 '다시 연결' 안내가 처리한다.
  ========================================================= */
  function _scheduleProactiveRefresh(expiresAt) {
    clearTimeout(_proactiveTimer);
    const lead = 2 * 60 * 1000;                                   // 만료 2분 전
    const delay = Math.max(30 * 1000, expiresAt - Date.now() - lead);
    _proactiveTimer = setTimeout(() => {
      if (document.visibilityState === 'hidden') return;          // 숨은 탭은 복귀 시 처리
      _silentRefresh().catch(() => {/* 조용히 실패 — 저장 시점 재연결 UI가 처리 */});
    }, delay);
  }

  function _bindVisibilityRefresh() {
    if (_visBound) return;
    _visBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (isDemo() || !tokenClient) return;
      const store = _store();
      if (!store.getItem(STORAGE_KEY_TOKEN)) return;              // 로그아웃 상태면 무시
      const expiresAt = parseInt(store.getItem(STORAGE_KEY_EXPIRES) || '0');
      // 이미 만료됐거나 2분 내 만료 예정이면 조용히 갱신 시도
      if (Date.now() > expiresAt - 2 * 60 * 1000) {
        _silentRefresh().catch(() => {});
      }
    });
  }

  // 토큰 요청 콜백 큐
  let _resolveTokenCallbacks = null;

  /* =========================================================
     로그인 (팝업)
  ========================================================= */
  function login() {
    return new Promise((resolve, reject) => {
      _resolveTokenCallbacks = (token, err) => {
        _resolveTokenCallbacks = null;
        _tokenRefreshPromise = null;
        if (err) reject(new Error(`로그인 실패: ${err}`));
        else resolve(token);
      };

      // 'select_account' → 계정 선택 UI 항상 표시
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  /* =========================================================
     토큰 갱신 (silent)
  ========================================================= */
  function _silentRefresh() {
    if (_tokenRefreshPromise) return _tokenRefreshPromise;

    _tokenRefreshPromise = new Promise((resolve, reject) => {
      _resolveTokenCallbacks = (token, err) => {
        _resolveTokenCallbacks = null;
        _tokenRefreshPromise = null;
        if (err) {
          const e = new Error(`토큰 갱신 실패: ${JSON.stringify(err)}`);
          // 팝업 차단/상호작용 필요 → 세션을 지우지 말고 '재연결' 흐름으로 보냄(요구사항 4)
          if (_isInteractionError(err)) e.code = 'reauth_required';
          reject(e);
        } else resolve(token);
      };
      if (!tokenClient) { _resolveTokenCallbacks(null, { type: 'no_client' }); return; }
      // prompt:'none' → 팝업 없이 silent 갱신. 구글이 조용히 갱신 못 하면 팝업으로 폴백하는데,
      // 사용자 제스처가 아니면 브라우저가 차단 → 'popup_failed_to_open'. 이 경우 reconnect 로 처리.
      try { tokenClient.requestAccessToken({ prompt: 'none' }); }
      catch (err) { _resolveTokenCallbacks?.(null, { type: 'popup_failed_to_open', raw: String(err) }); }
    });

    return _tokenRefreshPromise;
  }

  // 상호작용(사용자 클릭)이 필요한 오류인지 판별 — 팝업 실패/세션 만료/동의 필요 등
  function _isInteractionError(err) {
    const s = (typeof err === 'string' ? err : JSON.stringify(err || '')).toLowerCase();
    return /popup|interaction_required|login_required|consent_required|access_denied|failed to open|no_client/.test(s);
  }

  /* =========================================================
     [v9] 재연결 — 사용자 클릭(제스처) 안에서 호출해야 팝업이 정상적으로 열린다.
       prompt:'' → 기존 세션 사용, 필요할 때만 최소 UI. 성공 시 토큰 콜백이 저장/선제갱신을 처리.
  ========================================================= */
  function reconnect() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) { reject(new Error('인증 모듈이 아직 초기화되지 않았습니다.')); return; }
      _tokenRefreshPromise = null;
      _resolveTokenCallbacks = (token, err) => {
        _resolveTokenCallbacks = null;
        if (err) reject(new Error(`재연결 실패: ${JSON.stringify(err)}`));
        else { _needsReauth = false; resolve(token); }
      };
      try { tokenClient.requestAccessToken({ prompt: '' }); }
      catch (err) { _resolveTokenCallbacks?.(null, { type: 'popup_failed_to_open', raw: String(err) }); }
    });
  }

  function needsReauth() { return _needsReauth; }

  /* =========================================================
     토큰 가져오기 (자동 갱신)
  ========================================================= */
  async function getToken() {
    const store = _store();
    const token    = store.getItem(STORAGE_KEY_TOKEN);
    const expiresAt = parseInt(store.getItem(STORAGE_KEY_EXPIRES) || '0');

    if (token && Date.now() < expiresAt) {
      return token;
    }

    // 만료됐으면 silent refresh 시도
    try {
      return await _silentRefresh();
    } catch (e) {
      // [v9] 팝업 차단 등 '상호작용 필요'면 세션/내용을 지우지 말고 재연결 안내로(요구사항 4).
      //      그 외(네트워크 등)면 기존대로 토큰 정리.
      if (e && e.code === 'reauth_required') {
        _needsReauth = true;
        throw e;
      }
      clearTokens();
      throw e;
    }
  }

  /* =========================================================
     로그아웃
  ========================================================= */
  function logout() {
    if (isDemo()) { exitDemo(); return; }
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (token && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(token, () => {});
    }
    clearTokens();
  }

  function clearTokens() {
    [localStorage, sessionStorage].forEach(s => {
      s.removeItem(STORAGE_KEY_TOKEN);
      s.removeItem(STORAGE_KEY_EXPIRES);
      s.removeItem(STORAGE_KEY_USER);
    });
  }

  /* =========================================================
     데모 모드 (OAuth 없이 둘러보기) — 세션 한정
     (기본 진입 화면은 구글 로그인. 데모는 새로 실행하면 풀린다)
  ========================================================= */
  const STORAGE_KEY_DEMO = 'darakbang_demo';

  function enterDemo() { sessionStorage.setItem(STORAGE_KEY_DEMO, '1'); }
  function exitDemo()  { sessionStorage.removeItem(STORAGE_KEY_DEMO); localStorage.removeItem(STORAGE_KEY_DEMO); }
  function isDemo()    { return sessionStorage.getItem(STORAGE_KEY_DEMO) === '1'; }

  /* =========================================================
     로그인 상태 유지 설정 (체크 시 localStorage, 해제 시 sessionStorage)
  ========================================================= */
  const STORAGE_KEY_PERSIST = 'darakbang_persist';
  function getPersist() { return localStorage.getItem(STORAGE_KEY_PERSIST) !== '0'; }   // 기본: 유지
  function setPersist(v) { localStorage.setItem(STORAGE_KEY_PERSIST, v ? '1' : '0'); }
  function _store() { return getPersist() ? localStorage : sessionStorage; }

  /* =========================================================
     로그인 상태 확인
  ========================================================= */
  function isLoggedIn() {
    if (isDemo()) return true;
    const store = _store();
    const token    = store.getItem(STORAGE_KEY_TOKEN);
    const expiresAt = parseInt(store.getItem(STORAGE_KEY_EXPIRES) || '0');
    return !!(token && Date.now() < expiresAt);
  }

  /* =========================================================
     사용자 정보 가져오기
  ========================================================= */
  async function fetchUserInfo() {
    // 데모 모드: 가상 사용자
    if (isDemo()) {
      return { id: 'demo', name: '데모 사용자', email: '데모 모드 · 로컬 저장', picture: '' };
    }

    // 캐시 우선
    const cached = _store().getItem(STORAGE_KEY_USER);
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }

    const token = await getToken();
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('사용자 정보 조회 실패');
    const user = await res.json();

    // 캐싱
    _store().setItem(STORAGE_KEY_USER, JSON.stringify({
      id:      user.id,
      name:    user.name,
      email:   user.email,
      picture: user.picture,
    }));

    return user;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    init,
    login,
    logout,
    getToken,
    reconnect,        // [v9] 사용자 클릭으로 토큰 재연결
    needsReauth,      // [v9] 재연결 대기 상태 조회
    isLoggedIn,
    fetchUserInfo,
    clearTokens,
    enterDemo,
    exitDemo,
    isDemo,
    getClientId,
    setClientId,
    isConfigured,
    getPersist,
    setPersist,
  };
})();
