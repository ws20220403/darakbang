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
          _resolveTokenCallbacks?.(response.access_token, null);
        },
        error_callback: (err) => {
          console.error('OAuth error_callback:', err);
          _resolveTokenCallbacks?.(null, err);
        },
      });
      resolve();
    } catch (e) {
      reject(e);
    }
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
        if (err) reject(new Error(`토큰 갱신 실패: ${JSON.stringify(err)}`));
        else resolve(token);
      };
      // prompt:'none' → 팝업 없이 silent 갱신. 실패 시 재로그인 필요
      tokenClient.requestAccessToken({ prompt: 'none' });
    });

    return _tokenRefreshPromise;
  }

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
      // silent refresh 실패 → 재로그인 필요
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
