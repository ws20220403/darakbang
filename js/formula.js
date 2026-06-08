/**
 * formula.js — 표/계산표 공용 수식 엔진 (v3)
 *
 * 엑셀식 셀 좌표(A1, B2 …)와 기본 함수/사칙연산을 평가한다.
 * 저장/DOM 과 분리되어 있어 TableTool(편집)과 Exporter(내보내기)가 함께 쓴다.
 *
 *   지원: =SUM, AVERAGE(AVG), MAX, MIN, COUNT, PRODUCT, ROUND, ABS
 *         범위 A1:B3, 인자나열 A1,B2,5, 사칙연산 =A1+B2*2, 괄호/음수
 *   순환참조는 예외를 던져 호출부에서 '#ERR' 로 처리.
 *
 * grid: 2차원 배열(원시 문자열). grid[r][c] === '=...' 이면 수식.
 */

const Formula = (() => {

  function colName(i) {
    let s = ''; i++;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function colIndex(letters) {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  function _rows(grid) { return grid.length; }
  function _cols(grid) { return grid.reduce((m, r) => Math.max(m, r.length), 0); }

  function _tokenize(src) {
    const tokens = [];
    let i = 0;
    const isLetter = (ch) => /[A-Za-z]/.test(ch);
    const isDigit = (ch) => /[0-9]/.test(ch);
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      if ('+-*/(),:'.includes(ch)) { tokens.push({ t: ch }); i++; continue; }
      if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
        let s = ''; while (i < src.length && /[0-9.]/.test(src[i])) s += src[i++];
        tokens.push({ t: 'num', v: parseFloat(s) }); continue;
      }
      if (isLetter(ch)) {
        let letters = ''; while (i < src.length && isLetter(src[i])) letters += src[i++];
        let digits = ''; while (i < src.length && isDigit(src[i])) digits += src[i++];
        if (digits) tokens.push({ t: 'cell', r: parseInt(digits, 10) - 1, c: colIndex(letters) });
        else tokens.push({ t: 'func', name: letters.toUpperCase() });
        continue;
      }
      throw new Error('알 수 없는 문자: ' + ch);
    }
    return tokens;
  }

  // 셀의 숫자값 (수식이면 평가). 빈칸/문자는 NaN.
  function cellNumber(grid, r, c, visiting) {
    if (r < 0 || c < 0 || r >= _rows(grid) || c >= _cols(grid)) return NaN;
    const key = r + ',' + c;
    if (visiting.has(key)) throw new Error('순환참조');
    const raw = ((grid[r] && grid[r][c]) || '').toString().trim();
    if (raw.startsWith('=')) {
      visiting.add(key);
      try { return evalFormula(grid, raw.slice(1), visiting); }
      finally { visiting.delete(key); }
    }
    if (raw === '') return NaN;
    const n = Number(raw.replace(/,/g, ''));
    return isNaN(n) ? NaN : n;
  }

  function evalFormula(grid, src, visiting) {
    const tokens = _tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parseExpr() {
      let v = parseTerm();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = next().t; const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        const op = next().t; const r = parseFactor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function parseFactor() {
      const tk = peek();
      if (!tk) throw new Error('수식 오류');
      if (tk.t === '-') { next(); return -parseFactor(); }
      if (tk.t === '+') { next(); return parseFactor(); }
      if (tk.t === '(') { next(); const v = parseExpr(); expect(')'); return v; }
      if (tk.t === 'num') { next(); return tk.v; }
      if (tk.t === 'func') { return parseFunc(); }
      if (tk.t === 'cell') { next(); const n = cellNumber(grid, tk.r, tk.c, visiting); return isNaN(n) ? 0 : n; }
      throw new Error('수식 오류');
    }
    function expect(t) { const tk = next(); if (!tk || tk.t !== t) throw new Error('괄호 오류'); }

    function gatherArg() {
      if (peek() && peek().t === 'cell' && tokens[pos + 1] && tokens[pos + 1].t === ':') {
        const a = next(); next(); const b = next();   // cell ':' cell
        if (!b || b.t !== 'cell') throw new Error('범위 오류');
        const vals = [];
        const r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r);
        const c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
          const n = cellNumber(grid, r, c, visiting);
          if (!isNaN(n)) vals.push(n);
        }
        return vals;
      }
      return [parseExpr()];
    }
    function parseFunc() {
      const fn = next().name;
      expect('(');
      let values = [];
      if (peek() && peek().t !== ')') {
        values = values.concat(gatherArg());
        while (peek() && peek().t === ',') { next(); values = values.concat(gatherArg()); }
      }
      expect(')');
      return applyFunc(fn, values);
    }
    function applyFunc(fn, vals) {
      const nums = vals.filter(v => typeof v === 'number' && !isNaN(v));
      switch (fn) {
        case 'SUM':     return nums.reduce((a, b) => a + b, 0);
        case 'AVERAGE':
        case 'AVG':     return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
        case 'MAX':     return nums.length ? Math.max(...nums) : NaN;
        case 'MIN':     return nums.length ? Math.min(...nums) : NaN;
        case 'COUNT':   return nums.length;
        case 'PRODUCT': return nums.length ? nums.reduce((a, b) => a * b, 1) : NaN;
        case 'ROUND':   { const x = nums[0] || 0, d = nums[1] || 0, p = Math.pow(10, d); return Math.round(x * p) / p; }
        case 'ABS':     return Math.abs(nums[0] || 0);
        default: throw new Error('알 수 없는 함수: ' + fn);
      }
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error('수식 오류');
    return result;
  }

  function fmt(v) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '#ERR';
    if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
    return String(v);
  }

  // (r,c) 셀에 표시할 문자열. 수식이면 계산결과/오류, 아니면 원문.
  function displayValue(grid, r, c) {
    const raw = ((grid[r] && grid[r][c]) || '').toString();
    if (raw.trim().startsWith('=')) {
      try { return fmt(evalFormula(grid, raw.trim().slice(1), new Set([r + ',' + c]))); }
      catch (e) { return '#ERR'; }
    }
    return raw;
  }

  function isFormula(raw) { return typeof raw === 'string' && raw.trim().startsWith('='); }

  // 표 전체의 표시값(내보내기용)
  function computeGrid(grid) {
    return grid.map((row, r) => row.map((_, c) => displayValue(grid, r, c)));
  }

  return { colName, colIndex, cellNumber, evalFormula, displayValue, isFormula, computeGrid, fmt };
})();
