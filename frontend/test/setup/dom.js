// Frontend modüllerinin Node'da çalışabilmesi için minimum tarayıcı ortamı.
// Bu dosya testlerde diğer importlardan ÖNCE yüklenmelidir.

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

function createElement(tag = 'div') {
  const element = {
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    className: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    classList: {
      _set: new Set(),
      add(name) { this._set.add(name); },
      remove(name) { this._set.delete(name); },
      contains(name) { return this._set.has(name); },
      toggle(name) { if (this._set.has(name)) this._set.delete(name); else this._set.add(name); }
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      elementsById.delete(this.id);
    },
    addEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return null; },
    focus() {}
  };
  return element;
}

const elementsById = new Map();
const body = createElement('body');
body.appendChild = child => {
  body.children.push(child);
  child.parentNode = body;
  if (child.id) elementsById.set(child.id, child);
  return child;
};

globalThis.window = globalThis;
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};
const listeners = new Map();
globalThis.addEventListener = (type, fn) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
};
globalThis.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
globalThis.dispatchEvent = event => {
  listeners.get(event.type)?.forEach(fn => fn(event));
  return true;
};

globalThis.document = {
  body,
  documentElement: createElement('html'),
  getElementById: id => elementsById.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement,
  // Testler belirli id'li elemanları DOM'a "yerleştirebilir".
  __register(id, element = createElement()) {
    element.id = id;
    elementsById.set(id, element);
    return element;
  },
  __reset() {
    elementsById.clear();
    body.children = [];
  }
};

globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
