/**
 * storage.js — 저장소 추상화 계층
 *
 * 같은 인터페이스를 두 백엔드가 구현한다.
 *   - Drive      : 실제 Google Drive (실사용 모드)
 *   - LocalStore : 브라우저 localStorage (데모/오프라인 모드)
 *
 * Workspace / Editor / App 는 Drive 를 직접 부르지 않고 항상 Storage 를 통한다.
 * 덕분에 OAuth 없이도(데모모드) 앱 전체 흐름을 구동·검증할 수 있다.
 */

const Storage = (() => {

  let _backend = null;
  let _mode = 'drive';   // 'drive' | 'demo'

  function setMode(mode) {
    _mode = mode === 'demo' ? 'demo' : 'drive';
    _backend = _mode === 'demo' ? LocalStore : Drive;
    return _mode;
  }

  function getMode() { return _mode; }
  function isDemo()  { return _mode === 'demo'; }

  // 백엔드 메서드를 그대로 위임
  const _d = (name) => (...args) => {
    if (!_backend) throw new Error('Storage 백엔드가 초기화되지 않았습니다.');
    if (typeof _backend[name] !== 'function') {
      throw new Error(`Storage 백엔드에 ${name} 가 없습니다.`);
    }
    return _backend[name](...args);
  };

  return {
    setMode,
    getMode,
    isDemo,

    // 공통 인터페이스
    initFolderStructure: _d('initFolderStructure'),
    readWorkspace:       _d('readWorkspace'),
    writeWorkspace:      _d('writeWorkspace'),
    readSettings:        _d('readSettings'),
    writeSettings:       _d('writeSettings'),
    readPage:            _d('readPage'),
    writePage:           _d('writePage'),
    deletePage:          _d('deletePage'),
    uploadImage:         _d('uploadImage'),
    getImageBlobUrl:     _d('getImageBlobUrl'),
    uploadFile:          _d('uploadFile'),       // 임의 파일(PDF/Word/Excel/hwp 등)
    getFileBlobUrl:      _d('getFileBlobUrl'),    // 다운로드용 URL
  };
})();
