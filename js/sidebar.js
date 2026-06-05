/**
 * sidebar.js — 사이드바 렌더링 및 이벤트 처리
 */

const Sidebar = (() => {

  let _expandedIds = new Set();

  /* =========================================================
     초기화
  ========================================================= */
  function init() {
    _expandedIds = new Set(Workspace.loadExpandedFromLocal());
    _bindEvents();
    render();
  }

  function _bindEvents() {
    // 새 페이지 버튼
    document.getElementById('btn-new-page')?.addEventListener('click', () => App.createNewPage());
    document.getElementById('btn-welcome-new-page')?.addEventListener('click', () => App.createNewPage());

    // 검색
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim();
      renderSearch(q);
    });
    searchInput?.addEventListener('search', () => {
      if (!searchInput.value) render();
    });
  }

  /* =========================================================
     전체 사이드바 렌더링
  ========================================================= */
  function render() {
    renderFavorites();
    renderPageTree();
  }

  /* =========================================================
     즐겨찾기 섹션
  ========================================================= */
  function renderFavorites() {
    const section = document.getElementById('favorites-section');
    const list    = document.getElementById('favorites-list');
    if (!section || !list) return;

    const favorites = Workspace.getFavorites();

    if (!favorites.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';

    favorites.forEach(meta => {
      const li = _createNavItem(meta, 0, true);
      list.appendChild(li);
    });
  }

  /* =========================================================
     페이지 트리
  ========================================================= */
  function renderPageTree() {
    const list = document.getElementById('pages-list');
    if (!list) return;

    const rootPages = Workspace.getRootPages();

    if (!rootPages.length) {
      list.innerHTML = '<li class="nav-empty">페이지가 없습니다</li>';
      return;
    }

    list.innerHTML = '';
    const currentId = Workspace.getCurrentPageId();
    rootPages.forEach(meta => {
      const li = _createNavItemTree(meta, 0, currentId);
      list.appendChild(li);
    });
  }

  function _createNavItemTree(meta, depth, currentId) {
    const children = Workspace.getChildren(meta.id);
    const isExpanded = _expandedIds.has(meta.id);
    const isActive   = meta.id === currentId;

    const li = document.createElement('li');
    li.className = `nav-item${isExpanded ? ' expanded' : ''}`;
    li.setAttribute('data-depth', depth);
    li.setAttribute('data-page-id', meta.id);

    // Row
    const row = document.createElement('div');
    row.className = `nav-item-row${isActive ? ' active' : ''}`;

    // Expand button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'nav-expand-btn';
    expandBtn.setAttribute('aria-label', isExpanded ? '접기' : '펼치기');
    expandBtn.innerHTML = children.length
      ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<span style="width:12px;height:12px;display:inline-block;"></span>`;

    if (children.length) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _toggleExpand(meta.id, li);
      });
    }

    // Icon
    const iconEl = document.createElement('span');
    iconEl.className = 'nav-item-icon';
    iconEl.textContent = meta.icon || '📄';

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'nav-item-title';
    titleEl.textContent = meta.title || '제목 없음';
    titleEl.title = meta.title || '제목 없음';

    // More button
    const moreBtn = document.createElement('button');
    moreBtn.className = 'nav-item-more';
    moreBtn.setAttribute('aria-label', '더보기');
    moreBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openContextMenu(e, meta);
    });

    // 클릭으로 페이지 이동
    row.addEventListener('click', () => App.navigateToPage(meta.id));

    // 우클릭 컨텍스트 메뉴
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      _openContextMenu(e, meta);
    });

    row.appendChild(expandBtn);
    row.appendChild(iconEl);
    row.appendChild(titleEl);
    row.appendChild(moreBtn);
    li.appendChild(row);

    // Children
    if (children.length) {
      const childrenEl = document.createElement('ul');
      childrenEl.className = 'nav-children nav-list';

      if (isExpanded) {
        children.forEach(child => {
          const childLi = _createNavItemTree(child, depth + 1, currentId);
          childrenEl.appendChild(childLi);
        });
      }

      li.appendChild(childrenEl);
    }

    return li;
  }

  /* =========================================================
     즐겨찾기 전용 아이템 (단순)
  ========================================================= */
  function _createNavItem(meta, depth, isFavorite = false) {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.setAttribute('data-depth', depth);
    li.setAttribute('data-page-id', meta.id);

    const row = document.createElement('div');
    row.className = `nav-item-row${meta.id === Workspace.getCurrentPageId() ? ' active' : ''}`;
    row.style.paddingLeft = `${8 + depth * 16}px`;

    const iconEl = document.createElement('span');
    iconEl.className = 'nav-item-icon';
    iconEl.textContent = meta.icon || '📄';

    const titleEl = document.createElement('span');
    titleEl.className = 'nav-item-title';
    titleEl.textContent = meta.title || '제목 없음';

    row.appendChild(iconEl);
    row.appendChild(titleEl);
    row.addEventListener('click', () => App.navigateToPage(meta.id));
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); _openContextMenu(e, meta); });

    li.appendChild(row);
    return li;
  }

  /* =========================================================
     펼침/접힘 토글
  ========================================================= */
  function _toggleExpand(pageId, liEl) {
    const isExpanded = _expandedIds.has(pageId);

    if (isExpanded) {
      _expandedIds.delete(pageId);
      liEl.classList.remove('expanded');
      const childrenEl = liEl.querySelector('.nav-children');
      if (childrenEl) childrenEl.innerHTML = '';
    } else {
      _expandedIds.add(pageId);
      liEl.classList.add('expanded');
      const childrenEl = liEl.querySelector('.nav-children');
      const currentId  = Workspace.getCurrentPageId();

      if (childrenEl) {
        const children = Workspace.getChildren(pageId);
        const depth    = parseInt(liEl.getAttribute('data-depth') || '0');
        children.forEach(child => {
          const childLi = _createNavItemTree(child, depth + 1, currentId);
          childrenEl.appendChild(childLi);
        });
      }
    }

    // localStorage에 저장
    Workspace.setExpandedPages([..._expandedIds]);
  }

  /* =========================================================
     컨텍스트 메뉴
  ========================================================= */
  function _openContextMenu(e, meta) {
    const isFav = Workspace.isFavorite(meta.id);

    UI.openContextMenu(e.clientX, e.clientY, {
      favorited: isFav,

      onRename: async () => {
        const newTitle = await UI.prompt('이름 바꾸기', meta.title || '제목 없음', '페이지 이름');
        if (newTitle) {
          await Workspace.renamePage(meta.id, newTitle);
          // 현재 페이지라면 제목도 업데이트
          if (meta.id === Workspace.getCurrentPageId()) {
            const titleInput = document.getElementById('page-title-input');
            if (titleInput) titleInput.textContent = newTitle;
          }
          render();
        }
      },

      onFavorite: async () => {
        const nowFav = await Workspace.toggleFavorite(meta.id);
        UI.toast(nowFav ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 제거했습니다.', 'success');
        render();
      },

      onNewSubpage: async () => {
        const result = await App.createNewPage(meta.id);
        if (result) {
          // 부모 펼치기
          if (!_expandedIds.has(meta.id)) {
            const liEl = document.querySelector(`[data-page-id="${meta.id}"]`);
            if (liEl) _toggleExpand(meta.id, liEl);
          }
          render();
        }
      },

      onDelete: async () => {
        const hasChildren = Workspace.getChildren(meta.id).length > 0;
        const confirmed = await UI.confirmDelete(meta.title || '제목 없음', hasChildren);
        if (!confirmed) return;

        const currentId = Workspace.getCurrentPageId();
        await Workspace.deletePage(meta.id);
        render();

        // 현재 페이지가 삭제됐으면 Welcome 화면으로
        if (currentId === meta.id) {
          App.showWelcome();
        }

        UI.toast('페이지가 삭제됐습니다.', 'info');
      },
    });
  }

  /* =========================================================
     검색
  ========================================================= */
  function renderSearch(query) {
    const pagesList    = document.getElementById('pages-list');
    const favSection   = document.getElementById('favorites-section');

    if (!query) {
      render();
      favSection?.classList.remove('hidden');
      return;
    }

    favSection?.classList.add('hidden');

    const results = Workspace.searchPages(query);

    if (!pagesList) return;
    pagesList.innerHTML = '';

    if (!results.length) {
      pagesList.innerHTML = '<li class="search-empty">검색 결과가 없습니다</li>';
      return;
    }

    results.forEach(meta => {
      const li = document.createElement('li');
      li.className = 'search-result-item';

      const highlighted = (meta.title || '제목 없음').replace(
        new RegExp(`(${escapeRegex(query)})`, 'gi'),
        '<mark>$1</mark>'
      );

      li.innerHTML = `
        <span class="search-result-icon">${meta.icon || '📄'}</span>
        <span class="search-result-title">${highlighted}</span>
      `;

      li.addEventListener('click', () => {
        App.navigateToPage(meta.id);
        document.getElementById('search-input').value = '';
        render();
      });

      pagesList.appendChild(li);
    });
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* =========================================================
     활성 페이지 표시 업데이트
  ========================================================= */
  function setActivePage(pageId) {
    document.querySelectorAll('.nav-item-row').forEach(row => {
      row.classList.remove('active');
    });
    const activeRow = document.querySelector(`[data-page-id="${pageId}"] > .nav-item-row`);
    if (activeRow) {
      activeRow.classList.add('active');
      activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  async function expandPage(pageId) {
    if (!pageId) return;
    _expandedIds.add(pageId);
    await Workspace.setExpandedPages([..._expandedIds]);
    render();
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    init,
    render,
    renderFavorites,
    renderPageTree,
    setActivePage,
    expandPage,
    renderSearch,
  };
})();
