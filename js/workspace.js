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
    // 존재의 원천은 parentId 이지만, 표시 순서는 부모 메타의 children 배열 순서를 따른다.
    // (본문 안 '하위 문서' 링크의 순서를 저장 시 children 에 반영 → 사이드바도 같은 순서)
    const kids = _workspace.pages.filter(p => p.parentId === parentId);
    const parentMeta = getPageMeta(parentId);
    const order = (parentMeta && Array.isArray(parentMeta.children)) ? parentMeta.children : [];
    if (!order.length) return kids;
    return kids.slice().sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;   // 순서 정보 없는 항목은 뒤로
      if (ib === -1) return -1;
      return ia - ib;
    });
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
     본문 ↔ 하위 페이지 링크 동기화 (요구사항 1·2)
  ========================================================= */

  /* 부모 본문 맨 아래에 하위문서 링크 블록 추가 (부모가 '열려있지 않은' 경우).
     부모가 현재 열려있으면 App 쪽에서 라이브 에디터에 직접 삽입한다. */
  async function appendChildLink(parentId, childId) {
    let data = _pageCache[parentId] || await Storage.readPage(parentId);
    if (!data) return false;
    if (!data.editorData || typeof data.editorData !== 'object') data.editorData = { blocks: [] };
    if (!Array.isArray(data.editorData.blocks)) data.editorData.blocks = [];

    const exists = data.editorData.blocks.some(
      b => b && b.type === 'pageLink' && b.data && b.data.pageId === childId
    );
    if (!exists) {
      data.editorData.blocks.push({ type: 'pageLink', data: { pageId: childId } });
      data.updatedAt = new Date().toISOString();
      await Storage.writePage(parentId, data);
      _pageCache[parentId] = data;
    }
    return true;
  }

  /* 부모 본문에서 특정 하위문서 링크 블록 제거 (부모가 '열려있지 않은' 경우).
     자식 삭제 시 죽은 링크가 남지 않도록. */
  async function removeChildLink(parentId, childId) {
    let data = _pageCache[parentId] || await Storage.readPage(parentId);
    if (!data || !data.editorData || !Array.isArray(data.editorData.blocks)) return false;

    const before = data.editorData.blocks.length;
    data.editorData.blocks = data.editorData.blocks.filter(
      b => !(b && b.type === 'pageLink' && b.data && b.data.pageId === childId)
    );
    if (data.editorData.blocks.length !== before) {
      data.updatedAt = new Date().toISOString();
      await Storage.writePage(parentId, data);
      _pageCache[parentId] = data;
    }
    return true;
  }

  /* 저장 시: 본문의 하위문서(pageLink) 순서를 부모 children 순서에 반영 (본문 → 사이드바) */
  function _syncChildrenOrderFromBody(meta, editorData) {
    if (!meta || !Array.isArray(meta.children) || meta.children.length < 2) return;
    if (!editorData || !Array.isArray(editorData.blocks)) return;

    const bodyOrder = [];
    for (const b of editorData.blocks) {
      if (b && b.type === 'pageLink' && b.data && b.data.pageId) bodyOrder.push(b.data.pageId);
    }
    if (bodyOrder.length < 2) return; // 본문에 링크가 2개 미만이면 순서 의미 없음

    const inBody = meta.children
      .filter(id => bodyOrder.includes(id))
      .sort((a, b) => bodyOrder.indexOf(a) - bodyOrder.indexOf(b));
    const notInBody = meta.children.filter(id => !bodyOrder.includes(id));
    meta.children = [...inBody, ...notInBody];
  }

  /* 즉시 동기화(저장 없이, in-memory): 본문 순서 → children. 바뀌면 true.
     자동저장(1.5s)을 기다리지 않고 사이드바를 곧바로 갱신하기 위함(체감 속도 ↑). */
  function syncChildrenOrderLive(pageId, editorData) {
    const meta = getPageMeta(pageId);
    if (!meta || !Array.isArray(meta.children) || meta.children.length < 2) return false;
    const before = meta.children.join('|');
    _syncChildrenOrderFromBody(meta, editorData);
    return meta.children.join('|') !== before;
  }

  /* 하위 페이지(형제) 순서 재배치 (사이드바 → 본문). 부모가 '열려있지 않을' 때.
     본문의 pageLink 슬롯은 그대로 두고, 슬롯에 들어갈 pageId 만 newOrder 순으로 재배치
     (자식 수 ≠ 링크 수, 죽은 링크가 있어도 안전). */
  async function reorderChildrenStored(parentId, newOrder) {
    const meta = getPageMeta(parentId);
    if (!meta) return false;
    meta.children = newOrder.slice();

    let data = _pageCache[parentId] || await Storage.readPage(parentId);
    if (data && data.editorData && Array.isArray(data.editorData.blocks)) {
      const blocks = data.editorData.blocks;
      const slots = [];
      blocks.forEach((b, i) => { if (b && b.type === 'pageLink' && b.data && b.data.pageId) slots.push(i); });
      const pageIds = slots.map(i => blocks[i].data.pageId);
      const rank = (id) => { const k = newOrder.indexOf(id); return k === -1 ? Number.MAX_SAFE_INTEGER : k; };
      const desired = pageIds.slice().sort((a, b) => rank(a) - rank(b));
      slots.forEach((slotIdx, k) => { blocks[slotIdx].data.pageId = desired[k]; });
      data.updatedAt = new Date().toISOString();
      await Storage.writePage(parentId, data);
      _pageCache[parentId] = data;
    }
    await _saveWorkspace();
    return true;
  }

  /* children(형제) id 배열 — 표시 순서대로 */
  function getChildrenIds(parentId) { return getChildren(parentId).map(p => p.id); }

  /* =========================================================
     루트 페이지 순서 변경 (요구사항 3 — 하위페이지 제외, 루트끼리만)
  ========================================================= */
  function _normalizedRootOrder() {
    const roots = _workspace.pages.filter(p => !p.parentId).map(p => p.id);
    const existing = (_workspace.rootPageOrder || []).filter(id => roots.includes(id));
    const missing = roots.filter(id => !existing.includes(id));
    return [...existing, ...missing];
  }

  /* 위로(-1)/아래로(+1) 한 칸 이동 */
  async function moveRootPage(pageId, direction) {
    const meta = getPageMeta(pageId);
    if (!meta || meta.parentId) return false;   // 루트 페이지만
    const order = _normalizedRootOrder();
    const idx = order.indexOf(pageId);
    const target = idx + (direction < 0 ? -1 : 1);
    if (idx === -1 || target < 0 || target >= order.length) return false;
    [order[idx], order[target]] = [order[target], order[idx]];
    _workspace.rootPageOrder = order;
    await _saveWorkspace();
    return true;
  }

  /* 드래그&드롭: pageId 를 beforePageId 앞으로 이동 (beforePageId 가 null 이면 맨 끝) */
  async function reorderRootPage(pageId, beforePageId) {
    const meta = getPageMeta(pageId);
    if (!meta || meta.parentId) return false;
    if (pageId === beforePageId) return false;
    const order = _normalizedRootOrder().filter(id => id !== pageId);
    if (beforePageId == null) {
      order.push(pageId);
    } else {
      const i = order.indexOf(beforePageId);
      if (i === -1) order.push(pageId);
      else order.splice(i, 0, pageId);
    }
    _workspace.rootPageOrder = order;
    await _saveWorkspace();
    return true;
  }

  function getRootIndex(pageId) {
    return _normalizedRootOrder().indexOf(pageId);
  }
  function getRootCount() {
    return _workspace.pages.filter(p => !p.parentId).length;
  }

  /* =========================================================
     페이지 복제 (요구사항 5) — 본문/아이콘 포함, 하위페이지는 제외
  ========================================================= */
  async function duplicatePage(pageId) {
    const srcMeta = getPageMeta(pageId);
    if (!srcMeta) return null;
    const srcData = _pageCache[pageId] || await Storage.readPage(pageId);
    if (!srcData) return null;

    const newId = UI.generateId();
    const now = new Date().toISOString();
    const parentId = srcMeta.parentId || null;

    // 본문 깊은 복사 + 하위문서(pageLink) 블록은 제거(자식까지 복제하지 않음 → 죽은 링크 방지)
    const clonedEditor = JSON.parse(JSON.stringify(srcData.editorData || { blocks: [] }));
    if (Array.isArray(clonedEditor.blocks)) {
      clonedEditor.blocks = clonedEditor.blocks.filter(b => !(b && b.type === 'pageLink'));
    }

    const newTitle = (srcMeta.title || '제목 없음') + ' (복사본)';
    const meta = { id: newId, title: newTitle, icon: srcMeta.icon || '📄', parentId, children: [], searchText: srcMeta.searchText || '' };
    const pageData = {
      id: newId, title: newTitle, icon: srcMeta.icon || '📄',
      coverImageId: parentId ? null : (srcData.coverImageId || null),
      parentId, createdAt: now, updatedAt: now, editorData: clonedEditor,
    };

    _workspace.pages.push(meta);
    if (!parentId) {
      // 원본 바로 뒤에 배치
      const order = _normalizedRootOrder();
      const i = order.indexOf(pageId);
      if (i === -1) order.push(newId); else order.splice(i + 1, 0, newId);
      _workspace.rootPageOrder = order;
    } else {
      const pm = getPageMeta(parentId);
      if (pm) {
        if (!pm.children) pm.children = [];
        // 끝에 추가 → 본문 링크도 맨 아래에 붙으므로 사이드바/본문 순서가 일치
        pm.children.push(newId);
      }
    }

    await Storage.writePage(newId, pageData);
    await _saveWorkspace();
    _pageCache[newId] = pageData;
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
      _syncChildrenOrderFromBody(meta, editorData); // 본문 하위문서 순서 → 사이드바 순서
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
        case 'spreadsheet': (d.cells || []).forEach(row => (row || []).forEach(c => parts.push(String(c || '')))); break;
        case 'attachment': parts.push(d.name || '', d.caption || ''); break;
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
    duplicatePage,
    appendChildLink,
    removeChildLink,
    moveRootPage,
    reorderRootPage,
    reorderChildrenStored,
    syncChildrenOrderLive,
    getChildrenIds,
    getRootIndex,
    getRootCount,
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
