#!/usr/bin/env node
// Trans Limbus QA: áp dụng replacements chính xác lên giá trị chuỗi của một file Work.
// Usage: node tools/qa/apply.mjs <file> <replacements.json>
// replacements.json: [{"old":"...","new":"..."}, ...] hoặc {"old":"new", ...}
// An toàn: round-trip check (BOM/CRLF/indent/trailing) trước khi ghi; chỉ thay giá trị
// chuỗi khớp CHÍNH XÁC toàn bộ giá trị; bỏ qua các field định danh (HARD_SKIP).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(QA_DIR, '..', '..');
const WORK = path.join(REPO, 'Work');

const [file, replPath] = process.argv.slice(2);
if (!file || !replPath) {
  console.error('Dùng: node tools/qa/apply.mjs <file> <replacements.json>');
  process.exit(1);
}

let pairs = JSON.parse(fs.readFileSync(replPath, 'utf8'));
if (!Array.isArray(pairs)) pairs = Object.entries(pairs).map(([oldStr, newStr]) => ({ old: oldStr, new: newStr }));
for (const pr of pairs) {
  if (typeof pr.old !== 'string' || typeof pr.new !== 'string') {
    console.error('Replacement không hợp lệ (cần {"old":<string>,"new":<string>}):', JSON.stringify(pr).slice(0, 200));
    process.exit(1);
  }
}
if (!pairs.length) { console.error('Replacements rỗng'); process.exit(1); }

const HARD_SKIP = new Set(['id', 'key', 'model', 'speaker', 'teller', 'personalityid', 'imgStr', 'iconId', 'iconID', 'usage', 'songWriter', 'abilityID']);
const map = new Map(pairs.map((x) => [x.old, x.new]));
const counts = new Map(pairs.map((x) => [x.old, 0]));

const p = path.join(WORK, file);
const buf = fs.readFileSync(p);
const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
const text = (bom ? buf.subarray(3) : buf).toString('utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const m = text.match(/\n(\s+)"/);
const indent = m ? m[1] : (text.includes('\n') ? 2 : null);
const trailing = text.endsWith('\n');
const json = JSON.parse(text);
const ser = (j) => { let out = JSON.stringify(j, null, indent).split('\n').join(eol); if (trailing) out += eol; return out; };
if (ser(json) !== text) { console.error('ROUND-TRIP FAIL — không sửa, báo lại'); process.exit(1); }

let applied = 0;
function walk(v, key) {
  if (typeof v === 'string') {
    if (key !== undefined && HARD_SKIP.has(key)) return v;
    if (map.has(v)) { counts.set(v, counts.get(v) + 1); applied++; return map.get(v); }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => walk(x, key));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = walk(val, k);
    return out;
  }
  return v;
}
if (json && typeof json === 'object' && Array.isArray(json.dataList)) {
  json.dataList = json.dataList.map((r) => walk(r, undefined));
} else if (json && typeof json === 'object') {
  for (const [k, val] of Object.entries(json)) json[k] = walk(val, k);
}

fs.writeFileSync(p, bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ser(json), 'utf8')]) : Buffer.from(ser(json), 'utf8'));

console.log('WROTE', file, '| applied:', applied);
let unused = 0;
for (const [oldStr, c] of counts) if (c === 0) { unused++; console.log('CHƯA KHỚP:', JSON.stringify(oldStr.slice(0, 150))); }
console.log('cặp:', pairs.length, '| khớp:', pairs.length - unused, '| không khớp:', unused);
