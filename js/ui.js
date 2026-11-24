// 여러 화면에서 같이 쓰는 작은 도구들
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@16.3.0/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.7/dist/purify.es.mjs';

marked.setOptions({ breaks: true, gfm: true });

// h('div.card', { onclick }, '내용', child) 형태로 요소를 만든다.
export function h(tag, props = {}, ...children) {
  if (props === null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') {
      // --이름 형태의 CSS 변수는 Object.assign으로 들어가지 않아서 setProperty로 넣는다
      for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el) => { el.replaceChildren(); return el; };

export function markdown(text) {
  // **『제목』** 처럼 굵게 표시가 한국어 문장부호에 붙으면 마크다운 규칙상 인식되지 않아서 직접 바꿔 준다
  const fixed = (text || '').replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  return DOMPurify.sanitize(marked.parse(fixed));
}

export function toast(message, ms = 2400) {
  for (const old of document.querySelectorAll('.toast')) old.remove(); // 겹치지 않게 이전 알림은 지운다
  const el = h('div.toast', message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// 별 표시: ★★☆ (채운 별, 빈 별)
export function starRow(n, max = 3, cls = '') {
  return h('span.stars' + (cls ? '.' + cls : ''), { 'aria-label': `별 ${n}개` },
    Array.from({ length: max }, (_, i) => h('span.star' + (i < n ? '.on' : ''), '★')));
}

// 미리보기용: 마크다운 기호를 걷어 내고 n글자로 자른다
export function short(text, n = 140) {
  const plain = (text || '').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > n ? plain.slice(0, n) + '…' : plain;
}

// textarea 높이를 내용에 맞춘다.
export function autoGrow(el, max = 160) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, max) + 'px';
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
