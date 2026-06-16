/**
 * samples.js — 샘플(사용법) 노트 콘텐츠
 * 데모 시드와 실(구글) 모드 첫 실행에서 공용으로 쓴다.
 * 생성된 페이지는 일반 노트와 동일하게 수정·삭제할 수 있다.
 *
 * v7: '다락방 사용법'을 현재 모든 기능을 담은 상세 설명서로 전면 재작성.
 *     (블록 변환에 코드·토글 추가, 단축키 안내 창 등 반영)
 */

const Samples = (() => {

  const USAGE_TITLE = '다락방 사용법';
  const USAGE_ICON = '📖';
  const USAGE_SEARCH =
    '사용법 도움말 가이드 매뉴얼 설명서 시작 데모 로그인 유지 화면구성 글쓰기 서식 굵게 기울임 밑줄 인라인코드 링크 ' +
    '자동변환 기호 화살표 마크다운 블록 추가 슬래시 변환 형식 텍스트 제목 목록 체크리스트 코드 토글 인용구 구분선 콜아웃 ' +
    '이미지 파일 첨부 pdf word excel hwp ppt zip 북마크 하위문서 목차 toc 표 함수 수식 좌표 천단위 콤마 ' +
    'sum average max min count product round abs 사칙연산 범위 셀이동 텍스트고정 드래그 순서 이동 양방향 동기화 ' +
    '저장 자동저장 되돌리기 복원 실행취소 undo redo 복제 이름변경 삭제 즐겨찾기 아이콘 커버 markdown 내보내기 전체백업 json ' +
    '검색 테마 다크모드 라이트 사이드바 너비 모바일 단축키 ctrl 구글 드라이브 연결 client id 배포 깃허브 휴지통 복구';

  // Editor.js 블록 배열 (데이터 형식 검증 완료)
  function _blocks() {
    return [
      { type: 'header', data: { text: '📖 다락방 사용법', level: 1 } },
      { type: 'paragraph', data: { text: '다락방의 <b>모든 기능</b>을 한 문서에 담은 설명서예요. 처음이라면 위에서부터 천천히, 필요한 기능만 찾고 싶다면 아래 <b>목차</b>를 누르세요.' } },
      { type: 'callout', data: { icon: '🗒️', color: 'green', text: '<b>이 문서도 평범한 노트입니다.</b> 직접 고치거나 블록을 옮겨보며 익혀도 되고, 다 보고 <b>삭제</b>해도 됩니다(사이드바에서 이 페이지 <b>⋯ → 삭제</b>).' } },
      { type: 'toc', data: {} },

      /* 1. 시작하기 */
      { type: 'header', data: { text: '🚀 1. 시작하기', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '<b>데모로 둘러보기</b> — 로그인 없이 바로 체험합니다. 데이터는 <b>이 브라우저에만</b> 저장돼요(드라이브로 전송 안 함).', items: [] },
        { content: '<b>구글 계정으로 로그인</b> — 내 구글 드라이브의 <code class="inline-code">DARAKBANG</code> 폴더에 저장합니다(아래 16번 설정 참고).', items: [] },
        { content: '<b>로그인 상태 유지</b>를 켜 두면 다음에 열 때 자동으로 들어옵니다(끄면 이번만).', items: [] },
      ] } },

      /* 2. 화면 구성 */
      { type: 'header', data: { text: '🧭 2. 화면 구성 한눈에', level: 2 } },
      { type: 'table', data: { withHeadings: true, content: [
        ['영역', '하는 일'],
        ['왼쪽 <b>사이드바</b>', '검색 · 즐겨찾기 · 페이지 목록 · “새 페이지” · 전체 백업(⤓)'],
        ['본문 <b>제목 줄</b>', '페이지 아이콘(이모지) · 제목 · “커버 추가”'],
        ['본문 <b>위쪽 줄</b>', '⌨️ 단축키 안내 · ←/→ 되돌리기·복원 · 저장'],
        ['오른쪽 위 <b>아이콘</b>', '🌙 테마 전환 · 로그아웃(데모는 “데모 종료”)'],
      ] } },
      { type: 'paragraph', data: { text: '사이드바와 본문 사이 경계선을 <b>드래그</b>하면 사이드바 너비를 조절할 수 있어요. 휴대폰에서는 왼쪽 위 <b>☰</b> 버튼으로 사이드바를 엽니다.' } },

      /* 3. 글쓰기 */
      { type: 'header', data: { text: '✍️ 3. 글쓰기와 글자 꾸미기', level: 2 } },
      { type: 'paragraph', data: { text: '본문 아무 곳이나 눌러 바로 입력하세요. 한 줄(블록)에서 <b>Enter</b>를 누르면 다음 블록으로 넘어가고, 빈 블록에서 <b>Backspace</b>를 누르면 위 블록과 합쳐집니다.' } },
      { type: 'paragraph', data: { text: '글자를 <b>드래그해 선택</b>하면 작은 도구막대가 떠요. 여기서 <b>굵게</b>, <i>기울임</i>, <u>밑줄</u>, <code class="inline-code">인라인 코드</code>, <b>링크</b>, 그리고 <b>변환</b>(아래 6번)을 쓸 수 있습니다.' } },

      /* 4. 자동 변환 */
      { type: 'header', data: { text: '✨ 4. 입력만 해도 바뀌는 자동 변환', level: 2 } },
      { type: 'paragraph', data: { text: '<b>기호 자동 변환</b> — 아래를 입력하면 그 즉시 기호로 바뀝니다.' } },
      { type: 'callout', data: { icon: '➡️', color: 'blue', text: '<code class="inline-code">-></code> → · <code class="inline-code">&lt;-</code> ← · <code class="inline-code">=></code> ⇒ · <code class="inline-code">&lt;=</code> ⇐ · <code class="inline-code">!=</code> ≠ · <code class="inline-code">...</code> … · <code class="inline-code">(c)</code> © · <code class="inline-code">(r)</code> ® · <code class="inline-code">(tm)</code> ™' } },
      { type: 'paragraph', data: { text: '<b>줄머리 마크다운</b> — 빈 줄 맨 앞에서 접두어를 입력하면 그 줄이 블록으로 바뀝니다.' } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '<code class="inline-code">#</code> · <code class="inline-code">##</code> · <code class="inline-code">###</code> + 칸(스페이스) → <b>제목</b> 1·2·3', items: [] },
        { content: '<code class="inline-code">-</code> 또는 <code class="inline-code">*</code> + 칸 → <b>글머리 목록</b>, <code class="inline-code">1.</code> + 칸 → <b>번호 목록</b>', items: [] },
        { content: '<code class="inline-code">&gt;</code> + 칸 → <b>토글</b>, <code class="inline-code">```</code> → <b>코드 블록</b>, <code class="inline-code">[]</code> 또는 <code class="inline-code">[ ]</code> → <b>체크리스트</b>', items: [] },
      ] } },
      { type: 'callout', data: { icon: '🛡️', color: 'yellow', text: '<b>예외</b> — 코드 블록 안과 한글 조합 중에는 자동 변환이 작동하지 않아요(코드의 <code class="inline-code">-></code>나 조합 중인 한글이 깨지지 않도록).' } },

      /* 5. 블록 추가 */
      { type: 'header', data: { text: '➕ 5. 블록 추가 ( + 또는 / )', level: 2 } },
      { type: 'paragraph', data: { text: '줄 왼쪽의 <b>+</b> 버튼을 누르거나 빈 줄에서 <b>/</b> 를 입력하면 추가 메뉴가 열립니다. 모든 블록이 <b>한 화면에 그리드</b>로 보이고, 검색어를 입력하거나 <b>방향키 + Enter</b>로 고를 수 있어요.' } },
      { type: 'table', data: { withHeadings: true, content: [
        ['블록', '설명'],
        ['텍스트 · 제목', '기본 문단, 제목 1·2·3'],
        ['목록 · 체크리스트', '글머리/번호 목록(Tab으로 중첩), 할 일 체크박스'],
        ['코드', '여러 줄 코드(들여쓰기·기호 그대로 보존)'],
        ['표', '행/열 표 + 엑셀식 함수(아래 7번)'],
        ['인용구 · 구분선', '인용 문단, 가로 구분선'],
        ['토글', '접고 펴는 블록. 제목 Enter→아래 새 토글, 내용 Enter→안에서 줄바꿈, 내용에 “- ”·“1. ” 글머리'],
        ['콜아웃', '강조 박스(아이콘 + 7가지 색)'],
        ['이미지 · 파일', '그림 업로드, PDF·Word·Excel·hwp·PPT·zip 첨부/다운로드'],
        ['북마크', '링크를 카드로(파비콘 + 제목)'],
        ['하위 문서 · 목차', '하위 페이지 링크, 제목 자동 수집 목차(TOC)'],
      ] } },

      /* 6. 변환 */
      { type: 'header', data: { text: '🔄 6. 블록 변환 (형식 바꾸기)', level: 2 } },
      { type: 'paragraph', data: { text: '이미 쓴 블록의 <b>종류를 바꾸는</b> 기능이에요. 예를 들어 평범한 문단을 <b>제목</b>이나 <b>토글</b>로 바꿀 수 있습니다.' } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '글자를 <b>드래그해 선택</b> → 뜨는 도구막대에서 <b>변환</b> 선택', items: [] },
        { content: '또는 블록 왼쪽 손잡이 <b>⠿ 클릭</b> → 메뉴에서 <b>변환</b>', items: [] },
        { content: '여러 블록을 함께 선택해 한 번에 바꿀 수도 있어요.', items: [] },
      ] } },
      { type: 'callout', data: { icon: '🔁', color: 'indigo', text: '<b>변환 가능한 형식</b> — 텍스트 · 제목 · 목록 · 체크리스트 · 인용구 · <b>코드</b> · <b>토글</b>. (코드·토글도 서로 바꿀 수 있습니다.)' } },
      { type: 'toggle', data: { isOpen: true, title: '예시: 토글 사용법 (제목 줄을 눌러 접었다 펴기)', content: '긴 설명이나 참고자료를 숨겨둘 때 좋아요. 빈 줄에서 <b>&gt;</b> + 칸을 입력해도 토글이 만들어집니다.<br>• <b>제목에서 Enter</b> → 바로 아래에 <b>새 토글</b>이 생깁니다(빈 제목이면 일반 문단으로 빠져나가요).<br>• <b>내용에서 Enter</b> → 토글 밖으로 나가지 않고 <b>여기 안에서 줄바꿈</b>됩니다.<br>• 내용 줄 맨 앞에 “- ”/“* ” → <b>•</b> 글머리, “1. ” → 번호로 이어집니다(빈 글머리에서 Enter면 해제).<br>• 이 토글을 선택해 <b>변환 → 텍스트</b>로 바꾸면 일반 문단이 됩니다.' } },

      /* 7. 표와 함수 */
      { type: 'header', data: { text: '🧮 7. 표와 함수', level: 2 } },
      { type: 'paragraph', data: { text: '표는 입력 영역 <b>가로폭을 꽉 채워</b> 만들어집니다(기본 2×2). 셀에 <code class="inline-code">=</code> 로 시작하는 <b>함수</b>를 넣으면 자동 계산되고, <code class="inline-code">=</code> 를 입력하는 순간 <b>열(A·B·C)·행(1·2·3) 좌표</b>와 함수 안내가 잠깐 표시됩니다.' } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '함수: <code class="inline-code">=SUM</code> · <code class="inline-code">AVERAGE</code> · <code class="inline-code">MAX</code> · <code class="inline-code">MIN</code> · <code class="inline-code">COUNT</code> · <code class="inline-code">PRODUCT</code> · <code class="inline-code">ROUND</code> · <code class="inline-code">ABS</code>', items: [] },
        { content: '사칙연산 <code class="inline-code">+ − × ÷ ( )</code> 와 범위 <code class="inline-code">A1:B3</code> 사용 (예: <code class="inline-code">=A1+B2*2</code>, <code class="inline-code">=SUM(B2:C2)</code>)', items: [] },
        { content: '<b>셀 이동</b>: 방향키(↑↓←→), <b>Tab</b>(오른쪽), <b>Enter</b>(아래). 좌우 방향키는 글자 끝에서 옆 칸으로 넘어갑니다.', items: [] },
        { content: '<b>텍스트로 두기</b>: 맨 앞에 <code class="inline-code">\'</code>(작은따옴표)를 붙이면 계산하지 않고 글자 그대로 둡니다 (예: <code class="inline-code">\'=D5+D6</code>).', items: [] },
        { content: '<b>행/열 추가</b>: 표 <b>오른쪽 ＋</b>(열) · <b>아래 ＋</b>(행). 표에 마우스를 올리면 작은 툴바에서 <b>머리글 · 1,000 · 행/열 삭제</b>.', items: [] },
        { content: '<b>1,000 버튼</b>: 켜면 <b>표 전체 숫자</b>를 천단위 콤마 + 반올림으로 보여줍니다(셀을 누르면 원래 값/수식 표시). 기본은 꺼짐.', items: [] },
      ] } },
      { type: 'table', data: { withHeadings: true, useThousands: true, content: [
        ['항목', '1월', '2월', '합계'],
        ['매출', '1200000', '1530000', '=SUM(B2:C2)'],
        ['비용', '450000', '620000', '=SUM(B3:C3)'],
        ['이익', '=B2-B3', '=C2-C3', '=SUM(B4:C4)'],
      ] } },
      { type: 'paragraph', data: { text: '위 표의 <b>합계·이익</b> 칸을 눌러 보세요. <code class="inline-code">=SUM(...)</code>·<code class="inline-code">=B2-B3</code> 수식이 보이고, 이 표는 <b>1,000</b> 이 켜져 있어 숫자가 콤마로 끊겨 보입니다(툴바에서 끄면 입력값 그대로).' } },

      /* 8. 순서 바꾸기 */
      { type: 'header', data: { text: '↕️ 8. 블록 순서 바꾸기', level: 2 } },
      { type: 'paragraph', data: { text: '블록 위에 마우스를 올리면 왼쪽에 손잡이 <b>⠿</b> 가 보여요. 잡고 위아래로 끌면 순서가 바뀌고 <b>파란 선</b>이 놓일 위치를 알려줍니다. 손잡이를 <b>한 번 클릭</b>하면 위로/아래로/삭제/변환 메뉴가 열립니다. (휴대폰은 길게 눌러 드래그)' } },
      { type: 'callout', data: { icon: '🧩', color: 'purple', text: '이 줄을 손잡이로 드래그해 다른 곳으로 옮겨보세요. 한 번 해 보면 바로 익혀집니다!' } },

      /* 9. 하위 페이지 */
      { type: 'header', data: { text: '🗂️ 9. 하위 페이지 (본문 ↔ 사이드바 연동)', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '사이드바에서 페이지의 <b>⋯ → 하위 페이지 추가</b> → 부모 본문 맨 아래에 <b>하위 문서 링크</b>가 자동으로 생깁니다(하위의 하위도 동일). 본문에서 <b>하위 문서</b> 블록을 추가해도 됩니다.', items: [] },
        { content: '<b>순서는 양방향으로 같게</b> 유지돼요. 본문에서 링크를 드래그하면 사이드바 순서가, 사이드바에서 옮기면 본문 순서가 함께 바뀝니다.', items: [] },
        { content: '본문에서 <b>하위 문서 링크를 지우면</b> 그 하위 페이지가 <b>사이드바에서도 사라집니다</b>(구글 모드는 드라이브 휴지통으로 가 복구 가능).', items: [] },
      ] } },

      /* 10. 페이지 순서 */
      { type: 'header', data: { text: '🔃 10. 페이지 순서 변경', level: 2 } },
      { type: 'paragraph', data: { text: '사이드바에서 페이지를 <b>드래그</b>하거나 <b>⋯ → 위로/아래로</b>로 옮깁니다. 최상위 페이지는 최상위끼리, 하위 페이지는 같은 부모의 형제끼리만 정렬돼 순서가 섞이지 않아요.' } },

      /* 11. 저장 · 되돌리기 */
      { type: 'header', data: { text: '💾 11. 저장 · 되돌리기 / 복원', level: 2 } },
      { type: 'checklist', data: { items: [
        { text: '입력을 멈추면 약 <b>1.5초 뒤 자동 저장</b> (상단에 저장 시각 표시)', checked: true },
        { text: '<b>Ctrl/⌘ + S</b> 또는 저장 버튼으로 즉시 저장', checked: true },
        { text: '구글 모드면 내 드라이브의 <code class="inline-code">DARAKBANG</code> 폴더에 저장', checked: false },
      ] } },
      { type: 'paragraph', data: { text: '상단 <b>←</b>(되돌리기)·<b>→</b>(복원) 버튼, 또는 <b>Ctrl/⌘ + Z</b> 와 <b>Ctrl/⌘ + Shift + Z</b> 로 방금 쓰거나 지운 내용을 되돌리고 다시 살릴 수 있어요. 입력이 멈춘 지점을 기준으로 <b>한 묶음씩</b> 묶여서, 한글워드(hwp)처럼 적당량씩 되돌아갑니다.' } },

      /* 12. 페이지 관리 */
      { type: 'header', data: { text: '🛠️ 12. 페이지 관리 · 내보내기 · 백업', level: 2 } },
      { type: 'table', data: { withHeadings: true, content: [
        ['하고 싶은 것', '방법'],
        ['새 페이지', '사이드바 맨 아래 “새 페이지”'],
        ['하위추가 · 복제 · 이름변경 · 삭제 · 즐겨찾기 · 위·아래 이동', '페이지에 마우스를 올리면 나오는 “⋯” 메뉴'],
        ['Markdown(.md) 내보내기', '“⋯ → Markdown 내보내기”'],
        ['전체 백업(.json)', '사이드바 맨 아래 ⤓ 버튼(모든 페이지 + 설정)'],
        ['아이콘 / 커버', '제목 위 아이콘 클릭, “커버 추가”'],
      ] } },
      { type: 'paragraph', data: { text: '삭제한 페이지는 (구글 모드에서) 영구 삭제가 아니라 <b>드라이브 휴지통</b>으로 가서 복구할 수 있어요. 데모 모드 삭제는 이 브라우저에서 바로 지워집니다.' } },

      /* 13. 검색 · 즐겨찾기 */
      { type: 'header', data: { text: '🔎 13. 검색 · ⭐ 즐겨찾기', level: 2 } },
      { type: 'paragraph', data: { text: '사이드바 상단 검색창은 <b>제목과 본문 내용</b>을 함께 찾습니다. 자주 보는 페이지는 “<b>⋯ → 즐겨찾기</b>”로 사이드바 위쪽 ⭐ 영역에 고정하세요.' } },

      /* 14. 테마 · 화면 */
      { type: 'header', data: { text: '🎨 14. 테마 · 화면', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '오른쪽 위 <b>🌙 / ☀️</b> 버튼으로 <b>다크 모드 ↔ 라이트 모드</b> 전환(선택은 브라우저에 기억됩니다).', items: [] },
        { content: '사이드바 경계선을 <b>드래그</b>하면 너비를 조절할 수 있어요.', items: [] },
        { content: '휴대폰·작은 화면에서는 사이드바가 숨겨지고 <b>☰</b> 버튼으로 엽니다.', items: [] },
      ] } },

      /* 15. 단축키 */
      { type: 'header', data: { text: '⌨️ 15. 단축키 한눈에', level: 2 } },
      { type: 'callout', data: { icon: '⌨️', color: 'blue', text: '상단 줄의 <b>⌨️ 단축키 버튼</b>을 누르면 편의기능별로 정리된 <b>단축키 안내 창</b>이 열립니다. 아래는 자주 쓰는 것만 추렸어요.' } },
      { type: 'table', data: { withHeadings: true, content: [
        ['단축키 / 동작', '하는 일'],
        ['<code class="inline-code">/</code>', '블록 추가 메뉴 열기(빈 줄에서)'],
        ['글자 선택 → <b>변환</b>', '블록 종류 바꾸기'],
        ['Ctrl/⌘ + S', '저장'],
        ['Ctrl/⌘ + Z', '되돌리기'],
        ['Ctrl/⌘ + Shift + Z', '복원(다시 실행)'],
        ['Esc', '열린 메뉴·창 닫기'],
      ] } },
      { type: 'paragraph', data: { text: '아래는 <b>코드 블록</b> 예시예요. 들여쓰기와 기호가 그대로 보존되고, 이 블록도 <b>변환</b> 메뉴로 일반 텍스트로 바꿀 수 있습니다.' } },
      { type: 'code', data: { code: '// 코드 블록은 자동 변환이 적용되지 않아 기호가 그대로 보존됩니다\nfunction greet(name) {\n  return "안녕하세요, " + name + "님!";\n}' } },

      /* 16. 구글 드라이브 */
      { type: 'header', data: { text: '☁️ 16. 구글 드라이브로 저장 (배포용)', level: 2 } },
      { type: 'paragraph', data: { text: '지금 데모 모드라면 이 브라우저에만 저장됩니다. 내 구글 드라이브에 저장하려면 로그인 화면의 <b>“⚙️ 구글 드라이브 연결 설정”</b>에서 본인 OAuth 클라이언트 ID를 한 번 입력하면 돼요(코드 수정 불필요). 직접 배포하려면 아래 콘솔에서 클라이언트 ID를 발급합니다.' } },
      { type: 'bookmark', data: { url: 'https://console.cloud.google.com/apis/credentials', title: 'Google Cloud Console — OAuth 클라이언트 ID 발급' } },

      /* 17. 로그인 · 데이터 */
      { type: 'header', data: { text: '🔐 17. 로그인 · 데모 · 데이터 위치', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '기본 화면은 <b>구글 계정 로그인</b>입니다(본인 계정만 쓰는 비공개 앱).', items: [] },
        { content: '<b>“로그인 상태 유지”</b>를 켜면 다음에 열 때 자동 로그인됩니다(끄면 이번만).', items: [] },
        { content: '<b>“데모로 둘러보기”</b>는 로그인 없이 체험하는 모드로, 데이터가 <b>이 브라우저(localStorage)에만</b> 저장됩니다.', items: [] },
        { content: '구글 모드 데이터는 내 드라이브 <code class="inline-code">DARAKBANG</code> 폴더에 저장됩니다.', items: [] },
      ] } },

      { type: 'delimiter', data: {} },
      { type: 'quote', data: { text: '작게 시작해 차곡차곡. 이 문서는 지워도 되고, 마음대로 바꿔도 됩니다.', caption: '다락방', alignment: 'left' } },
    ];
  }

  function usageEditorData() {
    // 깊은 복사로 원본 보호(에디터가 데이터를 변형해도 안전)
    return { time: 0, blocks: JSON.parse(JSON.stringify(_blocks())) };
  }

  return { USAGE_TITLE, USAGE_ICON, USAGE_SEARCH, usageEditorData };
})();
