'use strict';
/**
 * DOM helpers shared by every panel (A6).
 *  h(tag, attrs, ...children)  — hyperscript; attrs.on{Event} bind listeners; attrs.html sets innerHTML
 *  btn(label, onClick, cls)    — every control is a real <button> with an action (no dead buttons, G10)
 *  modal({title, body, actions, cls, dismissable}) → Promise<actionValue>
 *  toast(text)
 *  download(name, text|Blob, mime)
 */
const { esc } = require('../core/format.js');

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function btn(label, onClick, cls = '', attrs = {}) {
  return h('button', Object.assign({ type: 'button', class: 'btn ' + cls, onclick: (e) => { onClick(e); } }, attrs), label);
}

let toastHost = null;
function toast(text, ms = 3200) {
  if (!toastHost) { toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
  const t = h('div', { class: 'toast' }, text);
  toastHost.appendChild(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

const modalStack = [];
/** actions: [{label, value, cls}] — resolves with chosen value; Escape resolves null when dismissable. */
function modal({ title, body, actions = [{ label: 'Close', value: null }], cls = '', dismissable = true, onMount }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const back = h('div', { class: 'modal-back', role: 'presentation' });
    const box = h('div', { class: 'modal ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' });
    const close = (v) => {
      back.remove(); document.removeEventListener('keydown', onKey, true);
      modalStack.splice(modalStack.indexOf(back), 1);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* element gone */ }
      resolve(v);
    };
    const onKey = (e) => {
      if (modalStack[modalStack.length - 1] !== back) return;
      if (e.key === 'Escape' && dismissable) { e.stopPropagation(); close(null); }
      if (e.key === 'Tab') { // focus trap
        const f = box.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    box.appendChild(h('h2', null, title));
    if (typeof body === 'string') box.appendChild(h('div', { html: body })); else if (body) box.appendChild(body);
    const acts = h('div', { class: 'actions' });
    for (const a of actions) acts.appendChild(btn(a.label, () => close(typeof a.value === 'function' ? a.value(box) : a.value), a.cls || (a === actions[actions.length - 1] ? 'primary' : ''), a.attrs || {}));
    box.appendChild(acts);
    back.appendChild(box);
    if (dismissable) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    document.body.appendChild(back);
    modalStack.push(back);
    document.addEventListener('keydown', onKey, true);
    if (onMount) onMount(box, close);
    const firstBtn = acts.querySelector('button');
    setTimeout(() => (box.querySelector('[autofocus]') || firstBtn || box).focus(), 0);
  });
}
const anyModalOpen = () => modalStack.length > 0;

function download(name, data, mime = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  window.__lastDownload = { name, size: blob.size, mime, text: typeof data === 'string' ? data : null };
  return window.__lastDownload;
}

function table(headers, rows) {
  return h('table', { class: 't' }, h('thead', null, h('tr', null, headers.map((x) => h('th', { html: x })))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => (c instanceof Node ? h('td', null, c) : h('td', { html: String(c) })))))));
}

function slider(label, { min, max, step = 1, value, onInput, fmt = (v) => v }) {
  const out = h('output', null, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label, oninput: () => { out.textContent = fmt(+inp.value); onInput(+inp.value); } });
  return h('label', { class: 'f' }, h('span', null, label + ': ', out), inp);
}

function select(label, options, value, onChange) {
  const s = h('select', { 'aria-label': label, onchange: () => onChange(s.value) }, options.map((o) => { const v = typeof o === 'object' ? o.value : o; const t = typeof o === 'object' ? o.label : o; return h('option', { value: v, selected: String(v) === String(value) }, t); }));
  return h('label', { class: 'f' }, label, s);
}

module.exports = { h, btn, toast, modal, anyModalOpen, download, table, slider, select, esc };
