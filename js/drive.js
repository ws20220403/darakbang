/**
 * drive.js — Google Drive API v3 레이어
 * drive.file scope 기반. 앱이 생성한 파일에만 접근.
 */

const Drive = (() => {

  const BASE_URL    = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_URL  = 'https://www.googleapis.com/upload/drive/v3';
  const APP_FOLDER  = 'DARAKBANG';
  const PAGES_FOLDER = 'pages';
  const IMAGES_FOLDER = 'images';

  // 폴더 ID 캐시 (세션 내)
  let _cache = {
    rootFolderId:   null,
    pagesFolderId:  null,
    imagesFolderId: null,
    workspaceFileId: null,
    settingsFileId:  null,
  };

  /* =========================================================
     공통 fetch 헬퍼
  ========================================================= */
  async function _fetch(url, options = {}) {
    const token = await Auth.getToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch {}
      throw new Error(`Drive API Error ${res.status}: ${errBody}`);
    }

    // 204 No Content
    if (res.status === 204) return null;

    // JSON 응답 반환 (content-type 체크)
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return res.json();
    }

    // 미디어(이미지 등) — Response 객체 자체를 반환
    return res;
  }

  /* =========================================================
     폴더 탐색 / 생성
  ========================================================= */
  async function findFolder(name, parentId = null) {
    // drive.file scope에서는 'root' in parents 쿼리가 제한될 수 있으므로
    // parentId가 없을 때는 부모 조건 없이 검색
    const parentQ = parentId ? ` and '${parentId}' in parents` : '';

    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentQ}`
    );

    const res = await _fetch(`${BASE_URL}/files?q=${q}&fields=files(id,name)&spaces=drive`);
    return res && res.files && res.files.length > 0 ? res.files[0] : null;
  }

  async function createFolder(name, parentId = null) {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    return await _fetch(`${BASE_URL}/files?fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
  }

  async function findOrCreateFolder(name, parentId = null) {
    const existing = await findFolder(name, parentId);
    if (existing) return existing;
    return await createFolder(name, parentId);
  }

  /* =========================================================
     앱 폴더 구조 초기화
  ========================================================= */
  async function initFolderStructure() {
    // 루트 DARAKBANG 폴더
    if (!_cache.rootFolderId) {
      const root = await findOrCreateFolder(APP_FOLDER, null);
      _cache.rootFolderId = root.id;
    }

    // pages/ 폴더
    if (!_cache.pagesFolderId) {
      const pages = await findOrCreateFolder(PAGES_FOLDER, _cache.rootFolderId);
      _cache.pagesFolderId = pages.id;
    }

    // images/ 폴더
    if (!_cache.imagesFolderId) {
      const images = await findOrCreateFolder(IMAGES_FOLDER, _cache.rootFolderId);
      _cache.imagesFolderId = images.id;
    }

    return _cache;
  }

  /* =========================================================
     JSON 파일 읽기/쓰기
  ========================================================= */
  async function findFile(name, parentId) {
    const q = encodeURIComponent(
      `name='${name}' and '${parentId}' in parents and trashed=false`
    );
    const res = await _fetch(`${BASE_URL}/files?q=${q}&fields=files(id,name)&spaces=drive`);
    return res && res.files && res.files.length > 0 ? res.files[0] : null;
  }

  // [버그수정] readFile: _fetch()가 JSON content-type이 아닌 경우 Response 객체를 반환하므로
  // alt=media 요청은 항상 미디어 바이트를 반환 → 직접 fetch하여 json() 호출
  async function readFile(fileId) {
    const token = await Auth.getToken();
    const res = await fetch(`${BASE_URL}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`파일 읽기 실패 ${res.status}: ${errText}`);
    }
    return res.json();
  }

  async function createJsonFile(name, data, parentId) {
    const content = JSON.stringify(data, null, 2);
    const boundary = '-------314159265358979323846';

    const metadata = JSON.stringify({
      name,
      mimeType: 'application/json',
      parents: [parentId],
    });

    // multipart/related 본문 수동 구성
    const body =
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      metadata +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      content +
      `\r\n--${boundary}--`;

    const res = await _fetch(`${UPLOAD_URL}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body,
    });
    return res; // { id, name }
  }

  // [버그수정] updateJsonFile: fields=id,name 추가하여 id를 반환받음
  async function updateJsonFile(fileId, data) {
    const content = JSON.stringify(data, null, 2);
    const res = await _fetch(`${UPLOAD_URL}/files/${fileId}?uploadType=media&fields=id,name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: content,
    });
    // PATCH media는 200 OK + JSON 반환
    if (res && res.id) return res;
    // 일부 응답이 null인 경우 fileId를 직접 반환
    return { id: fileId, name: data.name || '' };
  }

  async function writeJsonFile(name, data, parentId) {
    const existing = await findFile(name, parentId);
    if (existing) {
      const updated = await updateJsonFile(existing.id, data);
      // updateJsonFile이 id를 반환 못할 경우 existing.id 사용
      return { id: updated?.id || existing.id, name };
    } else {
      return await createJsonFile(name, data, parentId);
    }
  }

  async function deleteFile(fileId) {
    // [안전] 영구 삭제 대신 구글 드라이브 휴지통으로 이동 → 실수해도 복구 가능
    await _fetch(`${BASE_URL}/files/${fileId}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
  }

  /* =========================================================
     workspace.json
  ========================================================= */
  async function readWorkspace() {
    const folderId = _cache.rootFolderId;
    if (!folderId) throw new Error('폴더 초기화 필요');

    if (!_cache.workspaceFileId) {
      const f = await findFile('workspace.json', folderId);
      if (f) _cache.workspaceFileId = f.id;
    }

    if (_cache.workspaceFileId) {
      return await readFile(_cache.workspaceFileId);
    }
    return null;
  }

  async function writeWorkspace(data) {
    const folderId = _cache.rootFolderId;
    const res = await writeJsonFile('workspace.json', data, folderId);
    if (res && res.id) _cache.workspaceFileId = res.id;
    return res;
  }

  /* =========================================================
     settings.json
  ========================================================= */
  async function readSettings() {
    const folderId = _cache.rootFolderId;
    if (!folderId) throw new Error('폴더 초기화 필요');

    if (!_cache.settingsFileId) {
      const f = await findFile('settings.json', folderId);
      if (f) _cache.settingsFileId = f.id;
    }
    if (_cache.settingsFileId) {
      return await readFile(_cache.settingsFileId);
    }
    return null;
  }

  async function writeSettings(data) {
    const folderId = _cache.rootFolderId;
    const res = await writeJsonFile('settings.json', data, folderId);
    if (res && res.id) _cache.settingsFileId = res.id;
    return res;
  }

  /* =========================================================
     pages/{id}.json
  ========================================================= */
  const _pageFileIds = {}; // pageId → fileId 캐시

  async function readPage(pageId) {
    const folderId = _cache.pagesFolderId;
    if (!folderId) throw new Error('폴더 초기화 필요');

    if (!_pageFileIds[pageId]) {
      const f = await findFile(`${pageId}.json`, folderId);
      if (f) _pageFileIds[pageId] = f.id;
    }

    if (_pageFileIds[pageId]) {
      return await readFile(_pageFileIds[pageId]);
    }
    return null;
  }

  async function writePage(pageId, data) {
    const folderId = _cache.pagesFolderId;
    const res = await writeJsonFile(`${pageId}.json`, data, folderId);
    if (res && res.id) _pageFileIds[pageId] = res.id;
    return res;
  }

  async function deletePage(pageId) {
    if (_pageFileIds[pageId]) {
      await deleteFile(_pageFileIds[pageId]);
      delete _pageFileIds[pageId];
    } else {
      const f = await findFile(`${pageId}.json`, _cache.pagesFolderId);
      if (f) await deleteFile(f.id);
    }
  }

  /* =========================================================
     바이너리(이미지/일반 파일) 업로드 + Blob URL
  ========================================================= */

  // 공통: 임의의 바이너리를 images/ 폴더에 multipart 업로드
  async function _uploadBinary(file, fileName, mimeType) {
    const folderId = _cache.imagesFolderId;
    if (!folderId) throw new Error('폴더 초기화 필요');

    const boundary = '-------314159265358979323846bin';
    const metadata = JSON.stringify({ name: fileName, mimeType, parents: [folderId] });
    const arrayBuffer = await file.arrayBuffer();

    const enc = new TextEncoder();
    const partHead = enc.encode(
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      metadata +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const partTail = enc.encode(`\r\n--${boundary}--`);

    const combined = new Uint8Array(partHead.length + arrayBuffer.byteLength + partTail.length);
    combined.set(partHead, 0);
    combined.set(new Uint8Array(arrayBuffer), partHead.length);
    combined.set(partTail, partHead.length + arrayBuffer.byteLength);

    const token = await Auth.getToken();
    const res = await fetch(`${UPLOAD_URL}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: combined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`업로드 실패: ${res.status} ${errText}`);
    }
    return await res.json();
  }

  async function uploadImage(file) {
    // 확장자 추출 (클립보드 이미지는 name이 없을 수 있음)
    const ext = (file.name || '').split('.').pop() || 'jpg';
    const imageId = UI.generateId();
    const fileName = `${imageId}.${ext}`;
    const mimeType = file.type || 'image/jpeg';
    const result = await _uploadBinary(file, fileName, mimeType);
    return { fileId: result.id, fileName, imageId };
  }

  // 임의 파일(PDF/Word/Excel/hwp 등) — 드라이브에는 원본 이름을 보존해 올린다
  async function uploadFile(file) {
    const safeName = (file.name || `file-${UI.generateId()}`).replace(/[\r\n]+/g, ' ').slice(0, 120);
    const mimeType = file.type || 'application/octet-stream';
    const result = await _uploadBinary(file, safeName, mimeType);
    return { fileId: result.id, name: file.name || safeName, size: file.size || 0, mime: mimeType };
  }

  async function getImageBlobUrl(fileId) {
    const token = await Auth.getToken();
    const res = await fetch(`${BASE_URL}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`파일 로드 실패: ${res.status}`);

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const getFileBlobUrl = getImageBlobUrl; // 동일 구현(드라이브는 alt=media 로 어떤 파일이든 받음)

  /* =========================================================
     PUBLIC API
  ========================================================= */
  return {
    initFolderStructure,
    readWorkspace,
    writeWorkspace,
    readSettings,
    writeSettings,
    readPage,
    writePage,
    deletePage,
    uploadImage,
    getImageBlobUrl,
    uploadFile,
    getFileBlobUrl,
    deleteFile,
    get cache() { return _cache; },
  };
})();
