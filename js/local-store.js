/**
 * local-store.js — localStorage 기반 데모/오프라인 백엔드
 *
 * Drive 와 동일한 인터페이스를 구현한다.
 * Google OAuth 없이도 앱 전체를 구동할 수 있는 "데모로 둘러보기" 모드.
 * 이미지는 dataURL 로 localStorage 에 저장한다(데모 한정).
 */

const LocalStore = (() => {

  const PREFIX = 'darakbang_demo_';
  const K = {
    workspace: PREFIX + 'workspace',
    settings:  PREFIX + 'settings',
    page:  (id) => `${PREFIX}page_${id}`,
    image: (id) => `${PREFIX}image_${id}`,
    seeded: PREFIX + 'seeded',
  };

  /* ---------- JSON 헬퍼 ---------- */
  function _get(key) {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function _set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      throw new Error('데모 저장 공간(localStorage)이 가득 찼습니다. 일부 내용을 줄여주세요.');
    }
  }

  /* ---------- 초기화 + 샘플 시드 ---------- */
  const SEED_VERSION = '3';   // 샘플(사용법 등) 내용이 바뀌면 올림 → 데모 데이터 갱신
  async function initFolderStructure() {
    // 데모는 체험용 샘플 데이터이므로, 버전이 바뀌면 새 샘플로 갱신한다.
    if (localStorage.getItem(K.seeded) !== SEED_VERSION) {
      _seed();
      localStorage.setItem(K.seeded, SEED_VERSION);
    }
    return { demo: true };
  }

  async function readWorkspace() { return _get(K.workspace); }
  async function writeWorkspace(data) { _set(K.workspace, data); return { id: 'local-workspace' }; }

  async function readSettings() { return _get(K.settings); }
  async function writeSettings(data) { _set(K.settings, data); return { id: 'local-settings' }; }

  async function readPage(id) { return _get(K.page(id)); }
  async function writePage(id, data) { _set(K.page(id), data); return { id: `local-page-${id}` }; }
  async function deletePage(id) { localStorage.removeItem(K.page(id)); }

  /* ---------- 이미지 (dataURL) ---------- */
  function _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('이미지 읽기 실패'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    const imageId = UI.generateId();
    const dataUrl = await _fileToDataUrl(file);
    try {
      localStorage.setItem(K.image(imageId), dataUrl); // 원본 문자열 그대로
    } catch (e) {
      throw new Error('데모 모드에서는 이미지 저장 공간이 부족할 수 있습니다. 더 작은 이미지를 사용하세요.');
    }
    return { fileId: imageId, fileName: file.name || `${imageId}.img`, imageId };
  }

  async function getImageBlobUrl(fileId) {
    const dataUrl = localStorage.getItem(K.image(fileId));
    if (!dataUrl) throw new Error('이미지를 찾을 수 없습니다.');
    return dataUrl; // dataURL 은 그대로 img.src 로 사용 가능
  }

  /* ---------- 데모 샘플 데이터 ---------- */
  function _seed() {
    const now = new Date().toISOString();

    const workspace = {
      version: '2.0',
      pages: [
        { id: 'demo-guide',   title: Samples.USAGE_TITLE,             icon: Samples.USAGE_ICON, parentId: null, children: [], searchText: Samples.USAGE_SEARCH },
        { id: 'demo-welcome', title: '다락방 v2에 오신 걸 환영합니다', icon: '🏠', parentId: null, children: [], searchText: '데모 모드 드래그 손잡이 추가 블록 목록 코드 표 북마크 목차 체크리스트 저장 인용구' },
        { id: 'demo-ideas',   title: '아이디어 메모',                  icon: '💡', parentId: null, children: [], searchText: '' },
      ],
      rootPageOrder: ['demo-guide', 'demo-welcome', 'demo-ideas'],
    };

    const settings = {
      favorites: ['demo-guide'],
      theme: document.documentElement.getAttribute('data-theme') || 'light',
      sidebarWidth: 260,
      expandedPages: ['demo-welcome'],
    };

    const welcome = {
      id: 'demo-welcome', title: '다락방 v2에 오신 걸 환영합니다', icon: '🏠',
      coverImageId: null, parentId: null, createdAt: now, updatedAt: now,
      editorData: {
        time: Date.now(),
        blocks: [
          { type: 'header', data: { text: '다락방 v2 🏠', level: 1 } },
          { type: 'paragraph', data: { text: '이건 <b>데모 모드</b>예요. 데이터는 이 브라우저(localStorage)에만 저장되고 구글 드라이브로 가지 않습니다. 마음껏 눌러보세요!' } },
          { type: 'callout', data: { text: '왼쪽 블록 앞의 <b>⠿ 손잡이</b>를 잡고 끌면 순서를 바꿀 수 있어요. <b>+</b> 버튼이나 <b>/</b> 를 누르면 추가할 블록을 한 화면에서 고를 수 있습니다.', icon: '✨', color: 'indigo' } },
          { type: 'header', data: { text: '이번에 새로 들어온 블록', level: 2 } },
          { type: 'list', data: { style: 'unordered', items: [
            { content: '목록 — 불릿 / 번호 (중첩 가능)', items: [] },
            { content: '코드 블록 — 여러 줄 코드', items: [] },
            { content: '표 — 행/열 표', items: [] },
            { content: '웹 북마크 & 목차(TOC)', items: [] },
          ] } },
          { type: 'checklist', data: { items: [
            { text: '드래그로 블록 옮겨보기', checked: false },
            { text: '/ 입력해서 블록 추가해보기', checked: false },
            { text: '저장(Ctrl+S) 후 새로고침해보기', checked: true },
          ] } },
          { type: 'code', data: { code: 'function 다락방() {\n  return \"내 생각을 담는 공간\";\n}' } },
          { type: 'quote', data: { text: '작은 다락방에 생각을 차곡차곡.', caption: '다락방', alignment: 'left' } },
          { type: 'delimiter', data: {} },
          { type: 'paragraph', data: { text: '아래 <b>표</b>도 드래그로 옮길 수 있어요.' } },
          { type: 'table', data: { withHeadings: true, content: [
            ['블록', '단축'],
            ['제목', '/제목'],
            ['목록', '/목록'],
          ] } },
        ],
      },
    };

    const guide = {
      id: 'demo-guide', title: Samples.USAGE_TITLE, icon: Samples.USAGE_ICON,
      coverImageId: null, parentId: null, createdAt: now, updatedAt: now,
      editorData: Samples.usageEditorData(),
    };

    const ideas = {
      id: 'demo-ideas', title: '아이디어 메모', icon: '💡',
      coverImageId: null, parentId: null, createdAt: now, updatedAt: now,
      editorData: { time: Date.now(), blocks: [
        { type: 'paragraph', data: { text: '자유롭게 적어보세요…' } },
      ] },
    };

    _set(K.workspace, workspace);
    _set(K.settings, settings);
    _set(K.page('demo-welcome'), welcome);
    _set(K.page('demo-guide'), guide);
    _set(K.page('demo-ideas'), ideas);
  }

  /* ---------- 데모 데이터 초기화(선택) ---------- */
  function resetDemo() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  return {
    initFolderStructure,
    readWorkspace, writeWorkspace,
    readSettings,  writeSettings,
    readPage, writePage, deletePage,
    uploadImage, getImageBlobUrl,
    resetDemo,
  };
})();
