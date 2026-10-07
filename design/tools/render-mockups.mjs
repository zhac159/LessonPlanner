#!/usr/bin/env node
// render.mjs — turn design-canvas mockups (*.dc.html) into static HTML + PNG screenshots.
// Node built-ins only. Usage:
//   node render.mjs --in <projectDir> --html-out <dir> [--png-out <dir>] [--only A.dc.html,B.dc.html]
//                   [--scale 2] [--chrome <path>] [--budget 8000]
// If --png-out is omitted, only HTML is written.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEFAULT_SIZE = { w: 1440, h: 900 };

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`);
    const eq = a.indexOf('=');
    if (eq > 0) { o[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) o[key] = true;
    else { o[key] = next; i++; }
  }
  return o;
}

// ---------------------------------------------------------------- helpers
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function toKebab(stem) {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// ---------------------------------------------------------------- expression lookup
const HOLE_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const MISSING = Symbol('missing');

function evalExpr(expr, scope) {
  expr = expr.trim();
  let negate = false;
  while (expr.startsWith('!')) { negate = !negate; expr = expr.slice(1).trim(); }
  let v;
  if (expr === 'true') v = true;
  else if (expr === 'false') v = false;
  else if (expr === 'null') v = null;
  else if (expr === 'undefined') v = undefined;
  else if (/^-?\d+(\.\d+)?$/.test(expr)) v = Number(expr);
  else if (/^(['"]).*\1$/.test(expr)) v = expr.slice(1, -1);
  else {
    const parts = expr.replace(/\[(\d+|'[^']*'|"[^"]*")\]/g, (_, k) => '.' + k.replace(/^['"]|['"]$/g, '')).split('.');
    v = parts[0] in scope ? scope[parts[0]] : MISSING;
    for (let i = 1; i < parts.length && v !== MISSING; i++) {
      v = v == null ? MISSING : v[parts[i]];
    }
    if (v === MISSING) v = undefined;
  }
  return negate ? !v : v;
}

// strip optional {{ }} around a directive attribute value, then evaluate
function evalDirective(raw, scope) {
  if (raw == null) return undefined;
  const m = /^\s*\{\{\s*([\s\S]*?)\s*\}\}\s*$/.exec(raw);
  return evalExpr(m ? m[1] : decodeEntities(raw), scope);
}

const BOOLEAN_ATTRS = new Set(['disabled', 'checked', 'selected', 'hidden', 'readonly', 'required',
  'open', 'multiple', 'autofocus', 'novalidate', 'inert', 'autoplay', 'controls', 'loop', 'muted']);

// Substitute holes in a plain markup segment (no sc-* directives inside).
function substitute(seg, scope, warn) {
  // 1. attributes containing holes
  seg = seg.replace(/(\s)([^\s=/<>"']+)\s*=\s*("([^"]*\{\{[^"]*)"|'([^']*\{\{[^']*)')/g,
    (all, ws, name, _q, dq, sq) => {
      const raw = dq ?? sq;
      const whole = /^\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/.exec(raw);
      if (whole) {
        const v = evalExpr(whole[1], scope);
        if (typeof v === 'function' || /^on/i.test(name)) return '';   // event handler -> drop attr
        if (v === undefined || v === null) {
          warn(`hole {{${whole[1]}}} in attribute ${name} is ${v}; attribute dropped`);
          return '';
        }
        if (BOOLEAN_ATTRS.has(name.toLowerCase()) && typeof v === 'boolean') return v ? `${ws}${name}=""` : '';
        return `${ws}${name}="${escapeHtml(v)}"`;
      }
      const out = raw.replace(HOLE_RE, (_, e) => {
        const v = evalExpr(e, scope);
        if (v === undefined || v === null || typeof v === 'function') {
          warn(`hole {{${e}}} in attribute ${name} is ${typeof v === 'function' ? 'a function' : v}; replaced with ''`);
          return '';
        }
        return escapeHtml(v);
      });
      return `${ws}${name}="${out.replace(/"/g, '&quot;')}"`;
    });
  // 2. text holes
  seg = seg.replace(HOLE_RE, (_, e) => {
    const v = evalExpr(e, scope);
    if (v === undefined || v === null || v === false || typeof v === 'function') {
      if (v === undefined) warn(`text hole {{${e}}} is undefined`);
      return '';
    }
    return escapeHtml(Array.isArray(v) ? v.join(', ') : v);
  });
  return seg;
}

// Find the matching close tag for <sc-NAME ...> starting search at `from`, honoring nesting.
function findClose(html, name, from) {
  const re = new RegExp(`<(/?)sc-${name}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (--depth === 0) return { start: m.index, end: m.index + m[0].length }; }
    else depth++;
  }
  return null;
}

// Expand sc-for / sc-if directives recursively, substituting holes with the current scope.
function expand(html, scope, warn) {
  const OPEN = /<sc-(for|if)\b([^>]*)>/gi;
  let out = '', pos = 0, m;
  OPEN.lastIndex = 0;
  while ((m = OPEN.exec(html))) {
    const name = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    const bodyStart = m.index + m[0].length;
    const close = findClose(html, name, bodyStart);
    if (!close) throw new Error(`Unclosed <sc-${name}> at offset ${m.index}`);
    const body = html.slice(bodyStart, close.start);
    out += substitute(html.slice(pos, m.index), scope, warn);
    if (name === 'for') {
      let list = evalDirective(attrs.list ?? attrs.each ?? attrs.items, scope);
      if (list == null) { warn(`sc-for list ${attrs.list} is ${list}; rendered nothing`); list = []; }
      if (!Array.isArray(list)) list = typeof list === 'object' ? Object.values(list) : [];
      const as = attrs.as || 'item';
      const idx = attrs['index-as'] || attrs.index;
      list.forEach((item, i) => {
        const s = Object.create(scope);
        s[as] = item; s.$index = i; if (idx) s[idx] = i;
        out += expand(body, s, warn);
      });
    } else {
      let v = evalDirective(attrs.value ?? attrs.test ?? attrs.when ?? attrs.condition, scope);
      if ('not' in attrs || 'negate' in attrs) v = !v;
      if (v) out += expand(body, scope, warn);
    }
    pos = close.end;
    OPEN.lastIndex = close.end;
  }
  out += substitute(html.slice(pos), scope, warn);
  return out;
}

// ---------------------------------------------------------------- the DC component
function runComponent(code, props, file) {
  class DCLogic {
    constructor(p) { this.props = p || {}; this.state = {}; }
    setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state, this.props) : s); }
    forceUpdate() {}
  }
  const factory = new Function('DCLogic',
    `"use strict";\n${code}\n;return (typeof Component !== 'undefined') ? Component : undefined;`);
  const Component = factory(DCLogic);
  if (!Component) throw new Error(`${file}: script defines no class Component`);
  const inst = new Component(props);
  if (!inst.props || typeof inst.props !== 'object') inst.props = props;
  else inst.props = Object.assign({}, props, inst.props);
  const data = typeof inst.renderVals === 'function' ? inst.renderVals() : {};
  // Scope = renderVals() output, falling back to the instance (methods, props, state),
  // so {{handler}} resolves to a function and is dropped.
  return Object.assign(Object.create(inst), data || {});
}

// ---------------------------------------------------------------- convert one file
export function convert(src, file = 'file') {
  const warnings = [];
  const warn = (msg) => { if (!warnings.includes(msg)) warnings.push(msg); };
  let html = src;

  // 1. support.js loader
  html = html.replace(/[ \t]*<script\b[^>]*\bsrc\s*=\s*["'][^"']*support\.js["'][^>]*>\s*<\/script>[ \t]*\r?\n?/gi, '');

  // 3. DC logic script (extract before anything else touches it)
  let props = {}, preview = null, data = {};
  const scriptRe = /[ \t]*<script\b([^>]*\bdata-dc-script\b[^>]*)>([\s\S]*?)<\/script>[ \t]*\r?\n?/i;
  const sm = scriptRe.exec(html);
  if (sm) {
    const attrs = parseAttrs(sm[1]);
    if (attrs['data-props']) {
      try { props = JSON.parse(decodeEntities(attrs['data-props'])); }
      catch (e) { warn(`could not parse data-props: ${e.message}`); }
    }
    preview = props.$preview || null;
    const cleanProps = Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')));
    data = runComponent(sm[2], cleanProps, file);
    html = html.slice(0, sm.index) + html.slice(sm.index + sm[0].length);
  } else {
    warn('no <script data-dc-script> found; rendering with empty data');
  }

  // 2. helmet -> head, unwrap x-dc
  const helmets = [];
  html = html.replace(/[ \t]*<helmet\b[^>]*>([\s\S]*?)<\/helmet>[ \t]*\r?\n?/gi, (_, inner) => { helmets.push(inner.trim()); return ''; });
  html = html.replace(/[ \t]*<\/?x-dc\b[^>]*>[ \t]*\r?\n?/gi, '');
  if (helmets.length) {
    const inject = helmets.join('\n') + '\n';
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, inject + '</head>');
    else html = html.replace(/<body\b/i, '<head>\n' + inject + '</head>\n<body');
  }

  // 4-7. directives + holes, only inside <body> (head is static apart from helmet)
  const bm = /<body\b[^>]*>/i.exec(html);
  const be = html.search(/<\/body>/i);
  if (bm && be > bm.index) {
    const start = bm.index + bm[0].length;
    html = html.slice(0, start) + expand(html.slice(start, be), data, warn) + html.slice(be);
  } else {
    html = expand(html, data, warn);
  }

  return { html, preview, props, data, warnings };
}

// ---------------------------------------------------------------- PNG check
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } finally { fs.closeSync(fd); }
}

function screenshot({ chrome, htmlPath, pngPath, w, h, scale, budget, profile }) {
  try { fs.unlinkSync(pngPath); } catch {}
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`,
    `--window-size=${w},${h}`,
    `--virtual-time-budget=${budget}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ];
  const t0 = Date.now();
  const r = spawnSync(chrome, args, { encoding: 'utf8', timeout: 120000, windowsHide: true });
  const ms = Date.now() - t0;
  if (r.error) throw new Error(`chrome failed to run: ${r.error.message}`);
  if (!fs.existsSync(pngPath)) {
    throw new Error(`chrome produced no PNG (exit ${r.status}).\n${(r.stderr || '').trim().slice(-1500)}`);
  }
  return ms;
}

// ---------------------------------------------------------------- main
async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || a.h || !a.in || !a['html-out']) {
    console.log('Usage: node render.mjs --in <projectDir> --html-out <dir> [--png-out <dir>]\n' +
      '                      [--only A.dc.html,B.dc.html] [--scale 2] [--chrome <path>] [--budget <ms>]');
    process.exit(a.help || a.h ? 0 : 2);
  }
  const inDir = path.resolve(a.in);
  const htmlOut = path.resolve(a['html-out']);
  const pngOut = a['png-out'] ? path.resolve(a['png-out']) : null;
  const scale = Number(a.scale || 1);
  const budget = Number(a.budget || 8000);
  const chrome = a.chrome || process.env.CHROME_PATH || DEFAULT_CHROME;
  const profile = path.join(os.tmpdir(), 'design-render-chrome-profile');

  let canvas = {};
  const canvasPath = path.join(inDir, 'canvas.json');
  if (fs.existsSync(canvasPath)) {
    try { canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8')); }
    catch (e) { console.warn(`! canvas.json unreadable: ${e.message}`); }
  }
  const boards = canvas.boards || {};

  const all = fs.readdirSync(inDir).filter((f) => f.toLowerCase().endsWith('.dc.html'));
  let files;
  if (a.only) {
    files = String(a.only).split(',').map((s) => s.trim()).filter(Boolean);
    for (const f of files) if (!all.includes(f)) { console.error(`x ${f} not found in ${inDir}`); process.exit(1); }
  } else {
    const order = (canvas.order || []).filter((f) => all.includes(f));
    files = [...order, ...all.filter((f) => !order.includes(f)).sort()];
    const missing = [...new Set([...(canvas.order || []), ...Object.keys(boards)])]
      .filter((f) => f.toLowerCase().endsWith('.dc.html') && !all.includes(f));
    if (missing.length) console.log(`(canvas.json lists files not on disk, skipped: ${missing.join(', ')})`);
  }
  if (!files.length) { console.error(`x no *.dc.html files in ${inDir}`); process.exit(1); }
  if (pngOut && !fs.existsSync(chrome)) { console.error(`x Chrome not found at ${chrome} (use --chrome)`); process.exit(1); }

  fs.mkdirSync(htmlOut, { recursive: true });
  if (pngOut) { fs.mkdirSync(pngOut, { recursive: true }); fs.mkdirSync(profile, { recursive: true }); }

  let failures = 0;
  for (const f of files) {
    const stem = f.replace(/\.dc\.html$/i, '');
    try {
      const { html, preview, warnings } = convert(fs.readFileSync(path.join(inDir, f), 'utf8'), f);
      const htmlPath = path.join(htmlOut, `${stem}.html`);
      fs.writeFileSync(htmlPath, html);
      const leftovers = [];
      if (/\{\{/.test(html)) leftovers.push('{{');
      if (/<\/?sc-/i.test(html)) leftovers.push('<sc-');
      if (leftovers.length) warnings.push(`output still contains ${leftovers.join(' and ')}`);

      const b = boards[f] || {};
      const w = Number(b.w || preview?.width || DEFAULT_SIZE.w);
      const h = Number(b.h || preview?.height || DEFAULT_SIZE.h);
      let line = `- ${f} -> ${path.relative(process.cwd(), htmlPath)}`;
      if (pngOut) {
        const pngPath = path.join(pngOut, `${toKebab(stem)}.png`);
        const ms = screenshot({ chrome, htmlPath, pngPath, w, h, scale, budget, profile });
        const got = pngSize(pngPath);
        const ew = Math.round(w * scale), eh = Math.round(h * scale);
        const ok = got && got.w === ew && got.h === eh;
        line += `, ${path.relative(process.cwd(), pngPath)} ${got ? `${got.w}x${got.h}` : '?'}` +
          ` (expected ${ew}x${eh}${ok ? ', OK' : ', MISMATCH'}) in ${(ms / 1000).toFixed(1)}s`;
        if (!ok) failures++;
      }
      console.log(line);
      for (const wmsg of warnings) console.log(`    ! ${wmsg}`);
    } catch (e) {
      failures++;
      console.error(`x ${f}: ${e.message}`);
    }
  }
  process.exit(failures ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
