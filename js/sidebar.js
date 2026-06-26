/**
 * sidebar.js — 사이드바 렌더링 및 이벤트 처리
 */

const Sidebar = (() => {

  let _expandedIds = new Set();
  let _dragId = null;        // 드래그 중인 페이지 id (요구사항 3)
  let _dragParent = null;    // 드래그 중인 페이지의 부모 id (루트면 null) — 같은 그룹끼리만 재배치

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

    // 전체 백업(JSON) 버튼 (요구사항 5)
    document.getElementById('btn-backup')?.addEventListener('click', () => App.exportFullBackup());

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
    iconEl.textContent = meta.icon ?? '📄';

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

    const ctxOpts = { allowReorder: true };   // 루트/하위 모두 위·아래 이동 허용(같은 그룹 내)

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openContextMenu(e, meta, ctxOpts);
    });

    // 클릭으로 페이지 이동
    row.addEventListener('click', () => App.navigateToPage(meta.id));

    // 우클릭 컨텍스트 메뉴
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      _openContextMenu(e, meta, ctxOpts);
    });

    row.appendChild(expandBtn);
    row.appendChild(iconEl);
    row.appendChild(titleEl);
    row.appendChild(moreBtn);
    li.appendChild(row);

    // 드래그&드롭으로 순서 변경 (루트는 루트끼리, 하위는 같은 부모의 형제끼리만)
    _makeDraggable(li, row, meta);

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
     드래그&드롭 순서 변경 (요구사항 3)
     - 루트는 루트끼리(rootPageOrder), 하위는 같은 부모의 형제끼리만.
       서로 다른 그룹(부모가 다른 항목) 위에는 드롭 표시/적용을 하지 않음 → 순서 정보가 꼬이지 않음.
  ========================================================= */
  function _clearDropMarkers() {
    document.querySelectorAll('.nav-item.drop-before, .nav-item.drop-after')
      .forEach(el => el.classList.remove('drop-before', 'drop-after'));
  }

  function _sameGroup(meta) { return (meta.parentId || null) === _dragParent; }

  function _makeDraggable(li, row, meta) {
    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', (e) => {
      _dragId = meta.id;
      _dragParent = meta.parentId || null;
      li.classList.add('nav-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', meta.id); } catch {}
      }
    });

    row.addEventListener('dragend', () => {
      _dragId = null; _dragParent = null;
      li.classList.remove('nav-dragging');
      _clearDropMarkers();
    });

    li.addEventListener('dragover', (e) => {
      if (_dragId == null || _dragId === meta.id || !_sameGroup(meta)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      _clearDropMarkers();
      li.classList.add(after ? 'drop-after' : 'drop-before');
    });

    li.addEventListener('dragleave', (e) => {
      if (!li.contains(e.relatedTarget)) li.classList.remove('drop-before', 'drop-after');
    });

    li.addEventListener('drop', async (e) => {
      if (_dragId == null || _dragId === meta.id || !_sameGroup(meta)) return;
      e.preventDefault();
      e.stopPropagation();
      const after = li.classList.contains('drop-after');
      const draggedId = _dragId;
      const parent = _dragParent;
      _clearDropMarkers();

      if (parent == null) {
        // 루트끼리
        let beforeId = meta.id;
        if (after) {
          const roots = Workspace.getRootPages();
          const idx = roots.findIndex(r => r.id === meta.id);
          beforeId = (idx >= 0 && roots[idx + 1]) ? roots[idx + 1].id : null;
        }
        await Workspace.reorderRootPage(draggedId, beforeId);
        render();
      } else {
        // 같은 부모의 형제끼리
        const ids = Workspace.getChildrenIds(parent).filter(id => id !== draggedId);
        const i = ids.indexOf(meta.id);
        ids.splice(after ? i + 1 : i, 0, draggedId);
        await App.reorderChildren(parent, ids);
      }
    });
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
    iconEl.textContent = meta.icon ?? '📄';

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
  function _openContextMenu(e, meta, opts = {}) {
    const isFav = Workspace.isFavorite(meta.id);

    // 위로/아래로 이동 (요구사항 3): 루트는 루트끼리, 하위는 같은 부모 형제끼리
    const allowReorder = opts.allowReorder === true;
    const isRoot = !meta.parentId;
    const sibs = allowReorder ? (isRoot ? Workspace.getRootPages().map(p => p.id) : Workspace.getChildrenIds(meta.parentId)) : [];
    const sibIdx = sibs.indexOf(meta.id);

    UI.openContextMenu(e.clientX, e.clientY, {
      favorited: isFav,
      showMove:    allowReorder && sibs.length > 1,
      canMoveUp:   sibIdx > 0,
      canMoveDown: sibIdx >= 0 && sibIdx < sibs.length - 1,

      onMoveUp: async () => {
        if (isRoot) { if (await Workspace.moveRootPage(meta.id, -1)) render(); }
        else { await App.moveChildPage(meta.id, -1); }
      },
      onMoveDown: async () => {
        if (isRoot) { if (await Workspace.moveRootPage(meta.id, +1)) render(); }
        else { await App.moveChildPage(meta.id, +1); }
      },

      onDuplicate: async () => {
        await App.duplicatePage(meta.id);
      },

      onExport: async () => {
        await App.exportPageMarkdown(meta.id);
      },

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
        const parentId  = meta.parentId;   // 삭제 전에 부모 기록
        await Workspace.deletePage(meta.id);

        // 부모 본문에 남은 '하위 문서' 링크(죽은 링크) 정리
        if (parentId) {
          try { await App.removeChildLinkFromParent(parentId, meta.id); } catch {}
        }
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
        <span class="search-result-icon">${meta.icon ?? '📄'}</span>
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
