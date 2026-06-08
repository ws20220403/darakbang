/**
 * export.js — 내보내기 유틸 (Editor.js 블록 → Markdown / 평문)
 * 요구사항 5: 페이지를 Markdown 으로, 전체를 JSON 으로 백업.
 */

const Exporter = (() => {

  /* HTML 인라인 서식을 Markdown 으로 (굵게/기울임/코드/링크) */
  function _inline(html) {
    if (html == null) return '';
    const d = document.createElement('div');
    d.innerHTML = String(html);

    const walk = (node) => {
      let out = '';
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) { out += c.textContent; return; }
        if (c.nodeType !== 1) return;
        const tag = c.tagName.toLowerCase();
        const inner = walk(c);
        switch (tag) {
          case 'b': case 'strong': out += `**${inner}**`; break;
          case 'i': case 'em':     out += `*${inner}*`;   break;
          case 'u':                out += inner;          break; // MD에 밑줄 없음
          case 'code':             out += `\`${inner}\``; break;
          case 'mark':             out += `==${inner}==`; break;
          case 'br':               out += '  \n';         break;
          case 'a': {
            const href = c.getAttribute('href') || '';
            out += href ? `[${inner}](${href})` : inner;
            break;
          }
          default: out += inner;
        }
      });
      return out;
    };
    return walk(d).replace(/ /g, ' ');
  }

  function _stripHtml(html) {
    if (html == null) return '';
    const d = document.createElement('div');
    d.innerHTML = String(html);
    return (d.textContent || '').replace(/ /g, ' ');
  }

  function _list(items, ordered, depth) {
    const pad = '  '.repeat(depth);
    let out = '';
    (items || []).forEach((it, i) => {
      const content = typeof it === 'string' ? it : (it.content || '');
      const marker = ordered ? `${i + 1}.` : '-';
      out += `${pad}${marker} ${_inline(content)}\n`;
      const sub = it && it.items;
      if (sub && sub.length) out += _list(sub, ordered, depth + 1);
    });
    return out;
  }

  function _table(content) {
    if (!content || !content.length) return '';
    // 수식(=...)이 있으면 계산된 표시값으로 내보낸다
    let grid = content.map(r => (r || []).map(c => (c == null ? '' : String(c))));
    try { if (typeof Formula !== 'undefined') grid = Formula.computeGrid(grid); } catch {}
    const rows = grid.map(r => r.map(c => _inline(c).replace(/\|/g, '\\|')));
    const cols = Math.max(...rows.map(r => r.length));
    const norm = rows.map(r => { while (r.length < cols) r.push(''); return r; });
    let out = `| ${norm[0].join(' | ')} |\n`;
    out += `| ${Array(cols).fill('---').join(' | ')} |\n`;
    for (let i = 1; i < norm.length; i++) out += `| ${norm[i].join(' | ')} |\n`;
    return out + '\n';
  }

  function blockToMarkdown(b) {
    const d = b.data || {};
    switch (b.type) {
      case 'header': {
        const lv = Math.min(6, Math.max(1, d.level || 2));
        return `${'#'.repeat(lv)} ${_inline(d.text)}\n\n`;
      }
      case 'paragraph': return `${_inline(d.text)}\n\n`;
      case 'list': return _list(d.items, (d.style === 'ordered'), 0) + '\n';
      case 'checklist':
        return (d.items || []).map(i => `- [${i.checked ? 'x' : ' '}] ${_inline(i.text)}`).join('\n') + '\n\n';
      case 'code': return '```\n' + (d.code || '') + '\n```\n\n';
      case 'quote': {
        const t = _inline(d.text).split('\n').map(l => `> ${l}`).join('\n');
        return t + (d.caption ? `\n> — ${_inline(d.caption)}` : '') + '\n\n';
      }
      case 'delimiter': return `---\n\n`;
      case 'callout': return `> ${d.icon || '💡'} ${_inline(d.text)}\n\n`;
      case 'toggle': return `**${_inline(d.title)}**\n\n${_inline(d.content)}\n\n`;
      case 'table': return _table(d.content);
      case 'spreadsheet': return _table(d.cells);   // 옛 계산표 호환
      case 'bookmark': return `[${d.title || d.url}](${d.url})\n\n`;
      case 'image': return `*(이미지${d.caption ? ': ' + _stripHtml(d.caption) : ''})*\n\n`;
      case 'attachment': return `📎 ${d.name || '첨부파일'}${d.caption ? ' — ' + _stripHtml(d.caption) : ''}\n\n`;
      case 'pageLink': {
        const meta = (typeof Workspace !== 'undefined') ? Workspace.getPageMeta(d.pageId) : null;
        return `↳ ${(meta?.icon || '📄')} ${meta?.title || '하위 문서'}\n\n`;
      }
      case 'toc': return '';
      default: return d.text ? `${_inline(d.text)}\n\n` : '';
    }
  }

  function toMarkdown(title, editorData) {
    let out = `# ${title || '제목 없음'}\n\n`;
    const blocks = (editorData && Array.isArray(editorData.blocks)) ? editorData.blocks : [];
    for (const b of blocks) out += blockToMarkdown(b);
    return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /* 평문 (단어 수 계산용) */
  function plainText(editorData) {
    const blocks = (editorData && Array.isArray(editorData.blocks)) ? editorData.blocks : [];
    const parts = [];
    const pushList = (items) => (items || []).forEach(it => {
      parts.push(_stripHtml(typeof it === 'string' ? it : it.content));
      if (it && it.items) pushList(it.items);
    });
    for (const b of blocks) {
      const d = b.data || {};
      switch (b.type) {
        case 'paragraph': case 'header': case 'quote': case 'callout': case 'toggle':
          parts.push(_stripHtml(d.text), _stripHtml(d.title), _stripHtml(d.content)); break;
        case 'code': parts.push(d.code || ''); break;
        case 'checklist': (d.items || []).forEach(i => parts.push(_stripHtml(i.text))); break;
        case 'list': pushList(d.items); break;
        case 'table': (d.content || []).forEach(r => (r || []).forEach(c => parts.push(_stripHtml(c)))); break;
        case 'spreadsheet': (d.cells || []).forEach(r => (r || []).forEach(c => parts.push(String(c || '')))); break;
        case 'attachment': parts.push(d.name || ''); break;
        case 'bookmark': parts.push(d.title || ''); break;
        default: break;
      }
    }
    return parts.filter(Boolean).join(' ');
  }

  return { toMarkdown, blockToMarkdown, plainText };
})();
