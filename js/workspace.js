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
    await Storage.initFolderStructure();

    // workspace.json 로드
    let ws = await Storage.readWorkspace();
    let isNewWorkspace = false;
    if (!ws) {
      // 최초 실행: 새 workspace (배열을 새로 만들어 기본값 공유 방지)
      ws = { version: '2.0', pages: [], rootPageOrder: [] };
      isNewWorkspace = true;
    }
    _workspace = ws;

    // settings.json 로드
    let settings = await Storage.readSettings();
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS, favorites: [], expandedPages: [] };
      await Storage.writeSettings(settings);
    }
    _settings = settings;

    // 테마 적용
    if (_settings.theme) {
      UI.applyTheme(_settings.theme);
    }

    // 사용법 샘플 노트를 일반 페이지로 보장 (최초 1회, 모드별). 삭제하면 다시 만들지 않음.
    void isNewWorkspace;
    await _ensureUsagePage();

    return { workspace: _workspace, settings: _settings };
  }

  /* 사용법 페이지가 없으면 1회 생성 (데모는 시드, 실모드는 첫 실행/기존 사용자 모두 커버) */
  async function _ensureUsagePage() {
    if (typeof Samples === 'undefined') return;
    const flagKey = 'darakbang_usage_seeded_' + (Storage.isDemo() ? 'demo' : 'drive');
    if (localStorage.getItem(flagKey)) return;
    const exists = _workspace.pages.some(p => p.title === Samples.USAGE_TITLE);
    if (!exists) {
      try { await _createStarterPage(); await _saveWorkspace(); }
      catch (e) { console.warn('사용법 페이지 생성 실패:', e); return; }
    }
    try { localStorage.setItem(flagKey, '1'); } catch {}
  }

  /* "사용법" 샘플 페이지 생성 (일반 노트와 동일) */
  async function _createStarterPage() {
    if (typeof Samples === 'undefined') return;
    const id = UI.generateId();
    const now = new Date().toISOString();
    const meta = { id, title: Samples.USAGE_TITLE, icon: Samples.USAGE_ICON, parentId: null, children: [], searchText: Samples.USAGE_SEARCH };
    const pageData = {
      id, title: meta.title, icon: meta.icon, coverImageId: null, parentId: null,
      createdAt: now, updatedAt: now, editorData: Samples.usageEditorData(),
    };
    _workspace.pages.push(meta);
    _workspace.rootPageOrder.push(id);
    await Storage.writePage(id, pageData);
    _pageCache[id] = pageData;
  }

  /* =========================================================
     workspace.json 저장
  ========================================================= */
  async function _saveWorkspace() {
    return await Storage.writeWorkspace(_workspace);
  }

  async function _saveSettings() {
    // 현재 테마도 저장
    _settings.theme = document.documentElement.getAttribute('data-theme') || 'light';
    return await Storage.writeSettings(_settings);
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
    const roots = _workspace.pages.filter(p => !p.parentId);
    const order = _workspace.rootPageOrder || [];
    // rootPageOrder 순서를 반영(없는 항목은 뒤로)
    return roots.slice().sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
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
  async function createPage(parentId = null, options = {}) {
    const id = UI.generateId();
    const title = options.title || '제목 없음';
    const icon = options.icon || '📄';
    const coverImageId = parentId ? null : (options.coverImageId || null);

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
      title,
      icon,
      parentId: parentId || null,
      children: [],
    };

    const pageData = {
      id,
      title,
      icon,
      coverImageId,
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
    await Storage.writePage(id, pageData);
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

    const data = await Storage.readPage(pageId);
    if (!data) throw new Error(`페이지를 찾을 수 없습니다: ${pageId}`);

    _pageCache[pageId] = data;
    return data;
  }

  /* =========================================================
     페이지 저장
  ========================================================= */
  async function savePage(pageId, editorData, title, icon, coverImageId) {
    if (!UI.isOnline() && !Storage.isDemo()) {
      UI.toast('인터넷 연결이 필요합니다. 연결 후 저장해주세요.', 'warning', 5000);
      return false;
    }

    const existing = _pageCache[pageId] || {};
    const now = new Date().toISOString();

    // 다른 기기에서 먼저 저장한 변경을 조용히 덮어쓰지 않도록 방어합니다.
    // 로컬에서 마지막으로 읽은 updatedAt과 Drive의 현재 updatedAt이 다르면 저장을 중단합니다.
    // (데모 모드는 단일 브라우저 저장이라 충돌 개념이 없으므로 건너뜁니다.)
    if (!Storage.isDemo()) {
      try {
        const remote = await Storage.readPage(pageId);
        if (
          remote?.updatedAt &&
          existing?.updatedAt &&
          remote.updatedAt !== existing.updatedAt
        ) {
          UI.toast('다른 기기에서 먼저 저장된 변경이 있습니다. 이 페이지를 다시 열어 확인한 뒤 저장해주세요.', 'warning', 9000);
          return false;
        }
      } catch (e) {
        console.warn('원격 변경 확인 실패:', e);
      }
    }

    const updated = {
      ...existing,
      id:           pageId,
      title:        title || '제목 없음',
      icon:         icon  || '📄',
      coverImageId: existing.parentId ? null : (coverImageId !== undefined ? coverImageId : existing.coverImageId),
      updatedAt:    now,
      editorData:   editorData,
    };

    // workspace 메타 업데이트
    const meta = getPageMeta(pageId);
    if (meta) {
      meta.title = updated.title;
      meta.icon  = updated.icon;
      meta.searchText = _extractText(editorData);   // 전체 텍스트 검색용 인덱스
    }

    await Storage.writePage(pageId, updated);
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
      await Storage.deletePage(pageId);
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
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.searchText && p.searchText.toLowerCase().includes(q))
    );
  }

  /* 본문 블록에서 평문 텍스트 추출 (검색 인덱스용) */
  function _extractText(editorData) {
    if (!editorData || !editorData.blocks) return '';
    const strip = (html) => {
      if (!html) return '';
      const d = document.createElement('div');
      d.innerHTML = html;
      return d.textContent || '';
    };
    const parts = [];
    for (const b of editorData.blocks) {
      const d = b.data || {};
      switch (b.type) {
        case 'paragraph': case 'header': case 'quote': case 'callout': case 'toggle':
          parts.push(strip(d.text), strip(d.title), strip(d.content), strip(d.caption));
          break;
        case 'code': parts.push(d.code || ''); break;
        case 'checklist': (d.items || []).forEach(i => parts.push(strip(i.text))); break;
        case 'list': {
          const walk = (items) => (items || []).forEach(it => {
            parts.push(strip(typeof it === 'string' ? it : it.content));
            if (it && it.items) walk(it.items);
          });
          walk(d.items);
          break;
        }
        case 'table': (d.content || []).forEach(row => (row || []).forEach(c => parts.push(strip(c)))); break;
        case 'bookmark': parts.push(d.title || '', d.url || ''); break;
        default: break;
      }
    }
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
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
