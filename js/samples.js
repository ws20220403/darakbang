/**
 * samples.js — 샘플(사용법) 노트 콘텐츠
 * 데모 시드와 실(구글) 모드 첫 실행에서 공용으로 쓴다.
 * 생성된 페이지는 일반 노트와 동일하게 수정·삭제할 수 있다.
 */

const Samples = (() => {

  const USAGE_TITLE = '다락방 사용법';
  const USAGE_ICON = '📖';
  const USAGE_SEARCH =
    '사용법 도움말 가이드 매뉴얼 시작 글쓰기 서식 굵게 링크 블록 추가 슬래시 목록 코드 표 함수 수식 좌표 천단위 콤마 sum average max min count product 사칙연산 파일 첨부 pdf word excel hwp 인용구 토글 콜아웃 이미지 북마크 하위문서 목차 드래그 순서 이동 양방향 동기화 복제 내보내기 백업 markdown 단어수 저장 자동저장 단축키 페이지 새 하위 이름 삭제 즐겨찾기 아이콘 커버 검색 구글 드라이브 연결 client id 배포 로그인 유지 데모';

  // Editor.js 블록 배열 (데이터 형식 검증 완료)
  function _blocks() {
    return [
      { type: 'header', data: { text: '📖 다락방 사용법', level: 1 } },
      { type: 'paragraph', data: { text: '다락방을 처음 쓰는 분을 위한 안내서예요. <b>이 문서도 평범한 노트</b>라서 마음대로 고치거나, 다 읽고 지워도 됩니다.' } },
      { type: 'callout', data: { icon: '🗑️', color: 'yellow', text: '지우려면 사이드바에서 이 페이지의 <b>⋯ → 삭제</b> (또는 블록별 ⠿ 손잡이 클릭 → 삭제).' } },

      { type: 'header', data: { text: '✍️ 1. 글쓰기 & 서식', level: 2 } },
      { type: 'paragraph', data: { text: '본문 아무 곳이나 클릭해 입력하세요. 한 줄(블록)에서 <b>Enter</b>를 누르면 다음 블록으로 넘어갑니다.' } },
      { type: 'paragraph', data: { text: '글자를 드래그해 선택하면 <b>굵게</b>, <i>기울임</i>, 밑줄, <code class="inline-code">인라인 코드</code>, 링크를 넣는 도구가 떠요.' } },
      { type: 'callout', data: { icon: '✨', color: 'green', text: '<b>자동 변환</b> — 입력만 해도 바로 바뀌어요. <code class="inline-code">-></code>→→ · <code class="inline-code">&lt;-</code>→← · <code class="inline-code">=></code>→⇒ · <code class="inline-code">&lt;=</code>→⇐ · <code class="inline-code">!=</code>→≠ · <code class="inline-code">...</code>→… · <code class="inline-code">(c)(r)(tm)</code>→©®™' } },
      { type: 'paragraph', data: { text: '줄 맨 앞에서 마크다운처럼 입력하면 블록이 바뀝니다: <code class="inline-code">[]</code>+칸 → 체크박스, <code class="inline-code">#</code>·<code class="inline-code">##</code>·<code class="inline-code">###</code>+칸 → 제목, <code class="inline-code">-</code>·<code class="inline-code">*</code>+칸 → 목록, <code class="inline-code">1.</code>+칸 → 번호목록, <code class="inline-code">&gt;</code>+칸 → 인용구, <code class="inline-code">```</code> → 코드.' } },

      { type: 'header', data: { text: '➕ 2. 블록 추가 ( + 또는 / )', level: 2 } },
      { type: 'paragraph', data: { text: '줄 왼쪽의 <b>+</b> 버튼을 누르거나, 빈 줄에서 <b>/</b> 를 입력하면 추가 메뉴가 열립니다. 모든 블록이 <b>한 화면</b>에 그리드로 보이고(많으면 메뉴 안에서 스크롤), 검색어를 입력하거나 방향키 + Enter로 고를 수 있어요.' } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '<b>제목</b> 1·2·3 — 문서 구조', items: [] },
        { content: '<b>목록</b> — 글머리 기호 / 번호 (Tab으로 들여쓰기 중첩)', items: [] },
        { content: '<b>체크리스트</b> — 할 일 체크박스', items: [] },
        { content: '<b>코드</b> — 여러 줄 코드 블록', items: [] },
        { content: '<b>표</b> — 행/열 표 + 엑셀식 함수 (아래 3번 참고)', items: [] },
        { content: '<b>파일</b> — PDF·Word·Excel·hwp·PPT·zip 등 첨부/다운로드', items: [] },
        { content: '<b>이미지 · 웹 북마크 · 하위 문서 · 목차(TOC)</b>', items: [] },
        { content: '<b>인용구 · 구분선 · 토글 · 콜아웃</b>', items: [] },
      ] } },

      { type: 'header', data: { text: '🧮 3. 표와 함수', level: 2 } },
      { type: 'paragraph', data: { text: '표는 입력 영역 <b>가로폭을 꽉 채워</b> 생깁니다. 셀에 <code class="inline-code">=</code> 로 시작하는 <b>함수</b>를 넣으면 자동 계산돼요. 함수를 쓰려고 <code class="inline-code">=</code> 를 입력하면 <b>열(A·B·C)·행(1·2·3) 좌표</b>와 사용 가능한 함수 안내가 잠깐 나타납니다.' } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '함수: <code class="inline-code">=SUM</code> · <code class="inline-code">AVERAGE</code> · <code class="inline-code">MAX</code> · <code class="inline-code">MIN</code> · <code class="inline-code">COUNT</code> · <code class="inline-code">PRODUCT</code> · <code class="inline-code">ROUND</code> · <code class="inline-code">ABS</code>', items: [] },
        { content: '사칙연산 <code class="inline-code">+ − × ÷ ( )</code> 와 범위 <code class="inline-code">A1:B3</code> 도 사용 (예: <code class="inline-code">=A1+B2*2</code>)', items: [] },
        { content: '<b>셀 이동</b>: <b>방향키</b>(↑↓←→)로 칸 이동(엑셀식 — 좌우는 글자 끝에서 옆 칸으로), <b>Tab</b>(오른쪽)·<b>Enter</b>(아래)로도 이동', items: [] },
        { content: '<b>텍스트로 두기</b>: 맨 앞에 <code class="inline-code">\'</code>(작은따옴표)를 붙이면 그대로 글자가 됩니다 (예: <code class="inline-code">\'=D5+D6</code> → <code class="inline-code">=D5+D6</code> 그대로 표시, 계산 안 함)', items: [] },
        { content: '행/열 추가: 표 <b>오른쪽 ＋(열)</b>, <b>아래 ＋(행)</b> 버튼. 표에 마우스를 올리면 작은 툴바에서 <b>머리글 · 1,000 · 행/열 삭제</b>', items: [] },
        { content: '<b>1,000 버튼</b>: 켜면 <b>표 전체 숫자</b>를 <b>천단위 콤마 + 소수점 반올림</b>으로 표시(끄면 입력 그대로). 셀을 클릭하면 원래 값/수식이 보입니다.', items: [] },
      ] } },
      { type: 'table', data: { withHeadings: true, useThousands: true, content: [
        ['항목', '1월', '2월', '합계'],
        ['매출', '1200000', '1530000', '=SUM(B2:C2)'],
        ['비용', '450000', '620000', '=SUM(B3:C3)'],
        ['이익', '=B2-B3', '=C2-C3', '=SUM(B4:C4)'],
      ] } },
      { type: 'paragraph', data: { text: '위 표의 <b>합계·이익</b> 칸을 눌러 보세요. <code class="inline-code">=SUM(...)</code>, <code class="inline-code">=B2-B3</code> 수식이 보이고, 이 표는 <b>1,000</b> 이 켜져 있어 숫자가 콤마로 끊겨 보입니다(툴바에서 끄면 입력값 그대로).' } },

      { type: 'header', data: { text: '↕️ 4. 순서 바꾸기 (드래그)', level: 2 } },
      { type: 'paragraph', data: { text: '블록 위에 마우스를 올리면 왼쪽에 손잡이 <b>⠿</b> 가 보여요. 잡고 위아래로 끌면 순서가 바뀌고 파란 선이 놓일 위치를 알려줍니다. 손잡이를 <b>한 번 클릭</b>하면 위로/아래로/삭제 메뉴가 열립니다. (모바일은 길게 눌러 드래그)' } },
      { type: 'callout', data: { icon: '🧩', color: 'indigo', text: '이 줄을 드래그해서 다른 곳으로 옮겨보세요. 바로 익혀집니다!' } },

      { type: 'header', data: { text: '🗂️ 5. 하위 페이지 (본문 ↔ 좌측 탭 자동 연동)', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '좌측 탭에서 페이지의 <b>⋯ → 하위 페이지 추가</b> → 이 본문 맨 아래에 <b>하위 문서 링크</b>가 자동으로 생깁니다(하위의 하위도 동일).', items: [] },
        { content: '<b>순서는 양방향으로 같게</b> 유지돼요. 본문에서 링크를 드래그하면 좌측 탭 순서가, 좌측 탭에서 옮기면 본문 순서가 함께 바뀝니다.', items: [] },
        { content: '본문에서 <b>하위 문서 링크를 지우면</b>(블록 선택 후 Backspace) 그 하위 페이지가 <b>좌측 탭에서도 사라집니다</b>(구글 모드는 드라이브 휴지통으로 가 복구 가능).', items: [] },
      ] } },

      { type: 'header', data: { text: '🔃 6. 페이지 순서 변경', level: 2 } },
      { type: 'paragraph', data: { text: '좌측 탭에서 페이지를 <b>드래그</b>하거나 <b>⋯ → 위로/아래로</b>로 옮깁니다. 최상위 페이지는 최상위끼리, 하위 페이지는 같은 부모의 형제끼리만 정렬돼서 순서가 섞이지 않아요.' } },

      { type: 'header', data: { text: '💾 7. 저장 · 되돌리기 / 복원', level: 2 } },
      { type: 'checklist', data: { items: [
        { text: '입력을 멈추면 약 1.5초 뒤 <b>자동 저장</b> (상단에 저장 시각 표시)', checked: true },
        { text: '<b>Ctrl/⌘ + S</b> 또는 저장 버튼으로 즉시 저장', checked: true },
        { text: '구글 모드면 내 드라이브의 <code class="inline-code">DARAKBANG</code> 폴더에 저장', checked: false },
      ] } },
      { type: 'paragraph', data: { text: '상단 우측 <b>← / →</b> 버튼(또는 <b>Ctrl/⌘ + Z</b> 되돌리기 · <b>Ctrl/⌘ + Shift + Z</b> 복원)으로 방금 쓰거나 지운 내용을 한 묶음씩 되돌리고 다시 살릴 수 있어요. 입력이 멈춘 지점을 기준으로 묶여서, 한글워드(hwp)처럼 한 번에 적당량씩 되돌아갑니다.' } },

      { type: 'header', data: { text: '🛠️ 8. 페이지 관리 / 내보내기', level: 2 } },
      { type: 'table', data: { withHeadings: true, content: [
        ['하고 싶은 것', '방법'],
        ['새 페이지', '사이드바 맨 아래 “새 페이지”'],
        ['하위 추가 / 복제 / 이름변경 / 삭제 / 즐겨찾기 / 위·아래 이동', '페이지에 마우스 올리면 나오는 “⋯” 버튼'],
        ['Markdown(.md)으로 내보내기', '“⋯ → Markdown 내보내기”'],
        ['전체 백업(.json)', '사이드바 맨 아래 ⤓ 버튼 (모든 페이지+설정)'],
        ['아이콘 / 커버', '제목 위 아이콘 클릭, “커버 추가”'],
      ] } },
      { type: 'paragraph', data: { text: '삭제한 페이지는 (구글 모드에서) 영구 삭제가 아니라 <b>드라이브 휴지통</b>으로 가서 복구할 수 있어요.' } },

      { type: 'header', data: { text: '🔎 9. 검색 & ⭐ 즐겨찾기', level: 2 } },
      { type: 'paragraph', data: { text: '사이드바 상단 검색창은 <b>제목과 본문 내용</b>을 함께 찾습니다. 자주 보는 페이지는 “⋯ → 즐겨찾기”로 위쪽에 고정하세요.' } },

      { type: 'header', data: { text: '☁️ 10. 구글 드라이브로 저장 (배포용)', level: 2 } },
      { type: 'paragraph', data: { text: '지금 데모 모드라면 이 브라우저에만 저장됩니다. 내 구글 드라이브에 저장하려면 로그인 화면의 <b>“⚙️ 구글 드라이브 연결 설정”</b>에서 본인 OAuth 클라이언트 ID를 한 번 입력하면 돼요(코드 수정 불필요).' } },
      { type: 'bookmark', data: { url: 'https://console.cloud.google.com/apis/credentials', title: 'Google Cloud Console — OAuth 클라이언트 ID 발급' } },

      { type: 'header', data: { text: '🔐 11. 로그인 / 데모', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        { content: '기본 화면은 <b>구글 계정 로그인</b>입니다.', items: [] },
        { content: '<b>“로그인 상태 유지”</b>를 켜면 다음에 열 때 자동 로그인됩니다(끄면 이번만).', items: [] },
        { content: '<b>“데모로 둘러보기”</b>는 로그인 없이 체험하는 모드예요(이 브라우저에만 저장).', items: [] },
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
