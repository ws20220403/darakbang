/**
 * workspace.js — 워크스페이스 & 페이지 상태 관리
 * Drive API를 통해 workspace.json, pages/{id}.json, settings.json을 읽고 씀
 */

const Workspace = (() => {

  /* =========================================================
     상태
  ========================================================= */
  let _workspace = null;    // workspace.json 데이터
  let _settings  = null;    // settings.json 데이터
  let _pageCache = {};      // pageId → pageData (로드된 페이지)
  let _currentPageId = null;
  let _isDirty = false;     // 미저장 변경 여부

  const DEFAULT_WORKSPACE = {
    version: '1.0',
    pages: [],            // { id, title, icon, parentId, children }
    rootPageOrder: [],
  };

  const DEFAULT_SETTINGS = {
    favorites: [],
    theme: 'light',
    sidebarWidth: 260,
    expandedPages: [],
  };

  /* =========================================================
     초기화 (앱 시작 시)
  ========================================================= */
  async function init() {
    // 폴더 구조 초기화
    await Drive.initFolderStructure();

    // workspace.json 로드
    let ws = await Drive.readWorkspace();
    if (!ws) {
      // 최초 실행: workspace 생성
      ws = { ...DEFAULT_WORKSPACE };
      await Drive.writeWorkspace(ws);
    }
    _workspace = ws;

    // settings.json 로드
    let settings = await Drive.readSettings();
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS };
      await Drive.writeSettings(settings);
    }
    _settings = settings;

    // 테마 적용
    if (_settings.theme) {
      UI.applyTheme(_settings.theme);
    }

    return { workspace: _workspace, settings: _settings };
  }

  /* =========================================================
     workspace.json 저장
  ========================================================= */
  async function _saveWorkspace() {
    return await Drive.writeWorkspace(_workspace);
  }

  async function _saveSettings() {
    // 현재 테마도 저장
    _settings.theme = document.documentElement.getAttribute('data-theme') || 'light';
    return await Drive.writeSettings(_settings);
  }

  /* =========================================================
     페이지 메타데이터 조회
  ========================================================= */
  function getPageMeta(pageId) {
    return _workspace.pages.find(p => p.id === pageId) || null;
  }

  function getAllPagesMeta() {
    return _workspace.pages || [];
  }

  function getRootPages() {
    return _workspace.pages.filter(p => !p.parentId);
  }

  function getChildren(parentId) {
    return _workspace.pages.filter(p => p.parentId === parentId);
  }

  function getDepth(pageId) {
    let depth = 0;
    let meta = getPageMeta(pageId);
    while (meta && meta.parentId) {
      depth++;
      meta = getPageMeta(meta.parentId);
      if (depth > 10) break; // safety
    }
    return depth;
  }

  function getAncestors(pageId) {
    const ancestors = [];
    let meta = getPageMeta(pageId);
    while (meta && meta.parentId) {
      const parent = getPageMeta(meta.parentId);
      if (parent) ancestors.unshift(parent);
      meta = parent;
    }
    return ancestors;
  }

  /* =========================================================
     페이지 생성
  ========================================================= */
  async function createPage(parentId = null) {
    const id = UI.generateId();

    // 깊이 제한 (최대 5단계)
    if (parentId) {
      const depth = getDepth(parentId);
      if (depth >= 4) {
        UI.toast('최대 5단계까지만 중첩 가능합니다.', 'warning');
        return null;
      }
    }

    const now = new Date().toISOString();
    const meta = {
      id,
      title: '제목 없음',
      icon:  '📄',
      parentId: parentId || null,
      children: [],
    };

    const pageData = {
      id,
      title: '제목 없음',
      icon:  '📄',
      coverImageId: null,
      parentId: parentId || null,
      createdAt: now,
      updatedAt: now,
      editorData: { blocks: [] },
    };

    // workspace 업데이트
    _workspace.pages.push(meta);
    if (!parentId) {
      _workspace.rootPageOrder.push(id);
    } else {
      const parentMeta = getPageMeta(parentId);
      if (parentMeta) {
        if (!parentMeta.children) parentMeta.children = [];
        parentMeta.children.push(id);
      }
    }

    // Drive에 저장
    await Drive.writePage(id, pageData);
    await _saveWorkspace();

    // 로컬 캐시
    _pageCache[id] = pageData;

    return { meta, pageData };
  }

  /* =========================================================
     페이지 로드
  ========================================================= */
  async function loadPage(pageId) {
    if (_pageCache[pageId]) return _pageCache[pageId];

    const data = await Drive.readPage(pageId);
    if (!data) throw new Error(`페이지를 찾을 수 없습니다: ${pageId}`);

    _pageCache[pageId] = data;
    return data;
  }

  /* =========================================================
     페이지 저장
  ========================================================= */
  async function savePage(pageId, editorData, title, icon, coverImageId) {
    if (!UI.isOnline()) {
      UI.toast('인터넷 연결이 필요합니다. 연결 후 저장해주세요.', 'warning', 5000);
      return false;
    }

    const existing = _pageCache[pageId] || {};
    const now = new Date().toISOString();

    const updated = {
      ...existing,
      id:           pageId,
      title:        title || '제목 없음',
      icon:         icon  || '📄',
      coverImageId: coverImageId !== undefined ? coverImageId : existing.coverImageId,
      updatedAt:    now,
      editorData:   editorData,
    };

    // workspace 메타 업데이트
    const meta = getPageMeta(pageId);
    if (meta) {
      meta.title = updated.title;
      meta.icon  = updated.icon;
    }

    await Drive.writePage(pageId, updated);
    await _saveWorkspace();

    _pageCache[pageId] = updated;
    _isDirty = false;

    return true;
  }

  /* =========================================================
     페이지 삭제 (재귀)
  ========================================================= */
  async function deletePage(pageId) {
    const meta = getPageMeta(pageId);
    if (!meta) return;

    // 하위 페이지 재귀 삭제
    const children = [...(meta.children || [])];
    for (const childId of children) {
      await deletePage(childId);
    }

    // Drive에서 파일 삭제
    try {
      await Drive.deletePage(pageId);
    } catch (e) {
      console.warn('페이지 파일 삭제 실패:', e);
    }

    // 부모에서 제거
    if (meta.parentId) {
      const parentMeta = getPageMeta(meta.parentId);
      if (parentMeta) {
        parentMeta.children = (parentMeta.children || []).filter(id => id !== pageId);
      }
    } else {
      _workspace.rootPageOrder = (_workspace.rootPageOrder || []).filter(id => id !== pageId);
    }

    // workspace.pages에서 제거
    _workspace.pages = _workspace.pages.filter(p => p.id !== pageId);

    // 즐겨찾기에서 제거
    _settings.favorites = (_settings.favorites || []).filter(id => id !== pageId);

    // 캐시 제거
    delete _pageCache[pageId];

    await _saveWorkspace();
    await _saveSettings();
  }

  /* =========================================================
     페이지 이름 바꾸기
  ========================================================= */
  async function renamePage(pageId, newTitle) {
    const meta = getPageMeta(pageId);
    if (meta) {
      meta.title = newTitle || '제목 없음';
    }
    if (_pageCache[pageId]) {
      _pageCache[pageId].title = newTitle || '제목 없음';
    }
    await _saveWorkspace();
  }

  /* =========================================================
     즐겨찾기
  ========================================================= */
  function isFavorite(pageId) {
    return (_settings.favorites || []).includes(pageId);
  }

  async function toggleFavorite(pageId) {
    const favorites = _settings.favorites || [];
    if (favorites.includes(pageId)) {
      _settings.favorites = favorites.filter(id => id !== pageId);
    } else {
      _settings.favorites = [...favorites, pageId];
    }
    await _saveSettings();
    return isFavorite(pageId);
  }

  function getFavorites() {
    return (_settings.favorites || [])
      .map(id => getPageMeta(id))
      .filter(Boolean);
  }

  /* =========================================================
     사이드바 펼침 상태
  ========================================================= */
  function getExpandedPages() {
    return _settings.expandedPages || [];
  }

  async function setExpandedPages(ids) {
    _settings.expandedPages = ids;
    // settings는 페이지 저장 시 함께 저장 (너무 자주 호출 방지)
    // localStorage에만 임시 저장
    localStorage.setItem('darakbang_expanded', JSON.stringify(ids));
  }

  function loadExpandedFromLocal() {
    try {
      return JSON.parse(localStorage.getItem('darakbang_expanded') || '[]');
    } catch { return []; }
  }

  /* =========================================================
     미저장 상태 관리
  ========================================================= */
  function markDirty() {
    _isDirty = true;
    document.getElementById('unsaved-indicator')?.classList.remove('hidden');
  }

  function markClean() {
    _isDirty = false;
    document.getElementById('unsaved-indicator')?.classList.add('hidden');
  }

  function isDirty() {
    return _isDirty;
  }

  /* =========================================================
     현재 페이지
  ========================================================= */
  function getCurrentPageId() {
    return _currentPageId;
  }

  function setCurrentPageId(id) {
    _currentPageId = id;
  }

  /* =========================================================
     페이지 검색 (제목 기반)
  ========================================================= */
  function searchPages(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    return _workspace.pages.filter(p =>
      p.title && p.title.toLowerCase().includes(q)
    );
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    init,
    getPageMeta,
    getAllPagesMeta,
    getRootPages,
    getChildren,
    getDepth,
    getAncestors,
    createPage,
    loadPage,
    savePage,
    deletePage,
    renamePage,
    isFavorite,
    toggleFavorite,
    getFavorites,
    getExpandedPages,
    setExpandedPages,
    loadExpandedFromLocal,
    markDirty,
    markClean,
    isDirty,
    getCurrentPageId,
    setCurrentPageId,
    searchPages,
    get workspace() { return _workspace; },
    get settings()  { return _settings; },
  };
})();
