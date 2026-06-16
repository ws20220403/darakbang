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
  const SEED_VERSION = '10';  // 샘플(사용법 등) 내용이 바뀌면 올림 → 데모 데이터 갱신 (v8: >→토글, 토글 Enter/글머리 반영)
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

  /* ---------- 임의 파일 (데모: dataURL) ---------- */
  // 데모 모드는 localStorage(수 MB) 한계가 있어 큰 파일은 저장이 어려울 수 있다.
  async function uploadFile(file) {
    const fileId = UI.generateId();
    const dataUrl = await _fileToDataUrl(file);
    try {
      localStorage.setItem(K.image(fileId), dataUrl);
    } catch (e) {
      throw new Error('데모 모드 저장 공간(localStorage)이 부족합니다. 더 작은 파일을 쓰거나 구글 드라이브 모드를 사용하세요.');
    }
    return { fileId, name: file.name || `${fileId}.bin`, size: file.size || 0, mime: file.type || 'application/octet-stream' };
  }

  async function getFileBlobUrl(fileId) {
    const dataUrl = localStorage.getItem(K.image(fileId));
    if (!dataUrl) throw new Error('파일을 찾을 수 없습니다.');
    return dataUrl; // dataURL → <a href> 다운로드에 사용 가능
  }

  /* ---------- 데모 샘플 데이터 ---------- */
  function _seed() {
    const now = new Date().toISOString();

    const workspace = {
      version: '2.0',
      pages: [
        { id: 'demo-guide',   title: Samples.USAGE_TITLE,             icon: Samples.USAGE_ICON, parentId: null, children: [], searchText: Samples.USAGE_SEARCH },
        { id: 'demo-welcome', title: '다락방 v3에 오신 걸 환영합니다', icon: '🏠', parentId: null, children: [], searchText: '데모 모드 드래그 손잡이 추가 블록 목록 코드 표 계산표 함수 파일 첨부 북마크 목차 체크리스트 저장 인용구' },
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
      id: 'demo-welcome', title: '다락방 v3에 오신 걸 환영합니다', icon: '🏠',
      coverImageId: null, parentId: null, createdAt: now, updatedAt: now,
      editorData: {
        time: Date.now(),
        blocks: [
          { type: 'header', data: { text: '다락방 v3 🏠', level: 1 } },
          { type: 'paragraph', data: { text: '이건 <b>데모 모드</b>예요. 데이터는 이 브라우저(localStorage)에만 저장되고 구글 드라이브로 가지 않습니다. 마음껏 눌러보세요!' } },
          { type: 'callout', data: { text: '왼쪽 블록 앞의 <b>⠿ 손잡이</b>를 잡고 끌면 순서를 바꿀 수 있어요. <b>+</b> 버튼이나 <b>/</b> 를 누르면 추가할 블록을 한 화면에서 고를 수 있습니다.', icon: '✨', color: 'indigo' } },
          { type: 'header', data: { text: 'v3에서 새로 들어온 것', level: 2 } },
          { type: 'list', data: { style: 'unordered', items: [
            { content: '<b>표에 함수</b> — 셀에 =SUM, =AVERAGE 같은 함수 (아래 예시)', items: [] },
            { content: '<b>파일</b> 첨부 — PDF·Word·Excel·hwp 등', items: [] },
            { content: '하위 페이지를 만들면 본문에 링크 자동 생성 + 순서 동기화(양방향)', items: [] },
            { content: '페이지 드래그&드롭 / ⋯ 위로·아래로 / 복제 / 내보내기 / 백업', items: [] },
          ] } },
          { type: 'paragraph', data: { text: '아래는 함수가 들어간 <b>표</b> 예시예요. 합계 칸을 눌러보면 <code class="inline-code">=SUM(...)</code> 수식이 보이고, 수식을 입력할 때 열(A·B·C)·행(1·2·3) 좌표가 살짝 나타납니다.' } },
          { type: 'table', data: { withHeadings: true, content: [
            ['항목', '1월', '2월', '합계'],
            ['매출', '100', '120', '=SUM(B2:C2)'],
            ['비용', '40', '55', '=SUM(B3:C3)'],
            ['평균', '=AVERAGE(B2:B3)', '=AVERAGE(C2:C3)', ''],
          ] } },
          { type: 'checklist', data: { items: [
            { text: '드래그로 블록 옮겨보기', checked: false },
            { text: '/ 입력해서 계산표·파일 추가해보기', checked: false },
            { text: '저장(Ctrl+S) 후 새로고침해보기', checked: true },
          ] } },
          { type: 'code', data: { code: 'function 다락방() {\n  return \"내 생각을 담는 공간\";\n}' } },
          { type: 'quote', data: { text: '작은 다락방에 생각을 차곡차곡.', caption: '다락방', alignment: 'left' } },
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
    uploadFile, getFileBlobUrl,
    resetDemo,
  };
})();
