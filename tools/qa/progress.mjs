#!/usr/bin/env node
// Trans Limbus translation QA progress tool.
// Usage: node tools/qa/progress.mjs <command> [...args]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(QA_DIR, '..', '..');
const WORK = path.join(REPO, 'Work');
const STATE_PATH = path.join(QA_DIR, 'progress.json');
const CONFIG_PATH = path.join(QA_DIR, 'config.json');
const GLOSSARY_PATH = path.join(QA_DIR, 'glossary.json');

const DEFAULT_CONFIG = {
  enDir: 'D:/Program Files/Steam/steamapps/common/Limbus Company/LimbusCompany_Data/Assets/Resources_moved/Localize/en',
  krDir: 'D:/Program Files/Steam/steamapps/common/Limbus Company/LimbusCompany_Data/Assets/Resources_moved/Localize/kr',
  jpDir: 'D:/Program Files/Steam/steamapps/common/Limbus Company/LimbusCompany_Data/Assets/Resources_moved/Localize/jp',
};
const cfg = () => {
  if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8');
  const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return { enDir: process.env.LIMBUS_EN || c.enDir, krDir: process.env.LIMBUS_KR || c.krDir, jpDir: process.env.LIMBUS_JP || c.jpDir };
};

const GROUP_ORDER = ['gameplay', 'story', 'rpg', 'ui', 'voice', 'other'];
function classify(rel) {
  if (rel.startsWith('StoryData/')) return 'story';
  if (rel.startsWith('RPGSystem/')) return 'rpg';
  if (/^(PersonalityVoiceDlg|EGOVoiceDig|BattleAnnouncerDlg|BgmLyrics)\//.test(rel)) return 'voice';
  const stem = path.posix.basename(rel, '.json');
  if (/^(AbEvents|ActionEvents|AbDlg_|StoryTheater|StoryText|StageNode|StageChapter|StagePart|DungeonArea|DungeonNode|DungeonName|DungeonText|RailwayDungeon|ThreadDungeon|ChoiceEvent|CultivationEvent|NightCleanUpEvent|TwiningThreads|HellsChicken|Event|Walpu|Tutorial)/.test(stem)) return 'story';
  if (/^(Skills|Passives|Bufs|BuffAbilities|BattleKeywords|EGOgift|EgoGift|Items|Egos|Personalities|Enemies|AbnormalityGuides|PanicInfo|MentalCondition|Assist|BattleHint|BattleResultHint|SkillTag|AttributeText|ResistText|SuccessRate|MirrorDungeonAbName|DanteAbility|KeywordDictionary|UnitKeyword|BattleSpeechBubbleDlg|BattlePass_Mission|IntroduceCharacter|Characters)/.test(stem)) return 'gameplay';
  if (/UI|Text|Menu|Shop|Gacha|Login|Banner|Filter|Ticket|IAP|Coupon|Attendance|Mission|Announcer|LobbyBGM|Reward|DanteNote|Voice|FileDownload|ErrorCode|FAQ|Agreements|Notice|Pass|Season|Title|Category|Skin|Formation|Upgrade|UserInfo|ReturnPolicy|Shotcut|Tooltip|Statistic|Quest|MirrorDungeon|Railway|Thread|BossRaid|Dungeon/.test(stem)) return 'ui';
  return 'other';
}
const baseRank = (stem) => /[-_](?=[a-zA-Z0-9])/.test(stem) ? 1 : 0;
const stemOf = (rel) => path.posix.basename(rel, '.json');

function listWork() {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.name.toLowerCase().endsWith('.json')) out.push(r);
    }
  })(WORK, '');
  return out.sort();
}
function loadState() { return fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { version: 1, events: [], files: {} }; }
function saveState(st) {
  st.updated = new Date().toISOString();
  const tmp = STATE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(st, null, 1), 'utf8');
  fs.renameSync(tmp, STATE_PATH);
}
function pushEvent(st, action, files, note) {
  st.events.push({ ts: new Date().toISOString(), action, files, note: note || '' });
  if (st.events.length > 1000) st.events = st.events.slice(-1000);
}
function requireState() {
  const st = loadState();
  if (!Object.keys(st.files).length) { console.error('progress.json trống — chạy `init` trước.'); process.exit(1); }
  return st;
}
function sortFiles(files) {
  return files.sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(classify(a)), gb = GROUP_ORDER.indexOf(classify(b));
    if (ga !== gb) return ga - gb;
    const ra = baseRank(stemOf(a)), rb = baseRank(stemOf(b));
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
function pickPending(st, n, group, order) {
  let files = Object.keys(st.files).filter(f => st.files[f].status === 'pending');
  if (group) files = files.filter(f => classify(f) === group);
  if (order === 'size-asc') files.sort((a, b) => st.files[a].size - st.files[b].size);
  else if (order === 'size-desc') files.sort((a, b) => st.files[b].size - st.files[a].size);
  else files = sortFiles(files);
  return files.slice(0, n);
}
const fmtSize = (n) => n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : n > 1024 ? Math.round(n / 1024) + 'KB' : n + 'B';

// ---------- verify helpers ----------
const HARD_SKIP = new Set(['id', 'key', 'model', 'speaker', 'teller', 'personalityid', 'imgStr', 'iconId', 'iconID', 'usage', 'songWriter', 'abilityID']);
function readInfo(p) {
  const buf = fs.readFileSync(p);
  const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = (bom ? buf.subarray(3) : buf).toString('utf8');
  let json = null, err = null;
  try { json = JSON.parse(text); } catch (e) { err = String(e.message).slice(0, 160); }
  return { bom, eol: text.includes('\r\n') ? 'CRLF' : 'LF', json, err };
}
function tokensOf(s) {
  const t = new Map();
  const add = (k) => t.set(k, (t.get(k) || 0) + 1);
  for (const m of s.matchAll(/\{[^{}]*\}/g)) add('{}:' + m[0]);
  for (const m of s.matchAll(/<[^<>]*>/g)) add('<>:' + m[0]);
  for (const m of s.matchAll(/\[[^\[\]]*\]/g)) add('[]:' + m[0]);
  const nl = (s.match(/\n/g) || []).length; if (nl) add('NL');
  return t;
}
const keyOf = (r) => r.id !== undefined ? 'i:' + r.id : (r.key !== undefined ? 'k:' + r.key : '?none');
function indexByKey(dataList) { const m = new Map(); for (const r of dataList) { const k = keyOf(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; }
function verifyFile(rel) {
  const c = cfg();
  const res = { rel, errors: [], warnings: [], stats: {} };
  const wp = path.join(WORK, rel);
  if (!fs.existsSync(wp)) { res.errors.push('Work file không tồn tại'); return res; }
  const vi = readInfo(wp);
  if (vi.err) { res.errors.push('JSON parse VI: ' + vi.err); return res; }
  const dir = path.posix.dirname(rel), base = path.posix.basename(rel);
  const enRel = dir === '.' ? 'EN_' + base : dir + '/EN_' + base;
  const enPath = path.join(c.enDir, enRel);
  const krPath = path.join(c.krDir, dir === '.' ? 'KR_' + base : dir + '/KR_' + base);
  if (!vi.json || !Array.isArray(vi.json.dataList)) { res.errors.push('VI không có dataList'); return res; }
  res.stats.viRecords = vi.json.dataList.length;
  let src = null, srcLang = null;
  if (fs.existsSync(enPath)) { src = enPath; srcLang = 'EN'; }
  else if (fs.existsSync(krPath)) { src = krPath; srcLang = 'KR'; }
  if (!src) { res.warnings.push('Không có file nguồn EN/KR để đối chiếu'); return res; }
  const ref = readInfo(src);
  if (ref.err || !ref.json || !Array.isArray(ref.json.dataList)) { res.warnings.push(`Không parse được ${srcLang} nguồn`); return res; }
  res.stats.srcLang = srcLang;
  const viList = vi.json.dataList, refList = ref.json.dataList;
  if (viList.length !== refList.length) res.errors.push(`Số record lệch: ${srcLang}=${refList.length} VI=${viList.length}`);
  const refIdx = indexByKey(refList), viIdx = indexByKey(viList);
  const missing = [...refIdx.keys()].filter(k => !viIdx.has(k));
  const extra = [...viIdx.keys()].filter(k => !refIdx.has(k));
  if (missing.length) res.errors.push(`Thiếu id/key (${missing.length}): ${missing.slice(0, 8).join(', ')}`);
  if (extra.length) res.errors.push(`Thừa id/key (${extra.length}): ${extra.slice(0, 8).join(', ')}`);
  let keyDiffs = 0;
  for (const k of refIdx.keys()) {
    if (!viIdx.has(k)) continue;
    const a = refIdx.get(k), b = viIdx.get(k);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const ka = Object.keys(a[i]).join(','), kb = Object.keys(b[i]).join(',');
      if (ka !== kb) { keyDiffs++; if (keyDiffs <= 5) res.errors.push(`Field khác id=${k}[${i}]: ${srcLang}=[${ka}] VI=[${kb}]`); }
    }
  }
  if (srcLang === 'EN') {
    let tokMiss = 0, tokExtra = 0, nlDiff = 0, fieldDiffs = 0;
    const samples = [];
    for (const k of refIdx.keys()) {
      if (!viIdx.has(k)) continue;
      const a = refIdx.get(k), b = viIdx.get(k);
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) {
        const ra = a[i], rb = b[i];
        for (const field of Object.keys(ra)) {
          if (HARD_SKIP.has(field) || typeof ra[field] !== 'string' || typeof rb[field] !== 'string') continue;
          if (ra[field] === rb[field]) continue;
          fieldDiffs++;
          const ta = tokensOf(ra[field]), tb = tokensOf(rb[field]);
          const seen = new Set();
          for (const [t, cnt] of ta) {
            const vc = tb.get(t) || 0;
            if (vc !== cnt) { tokMiss += (cnt > vc ? 1 : 0); tokExtra += (vc > cnt ? 1 : 0); if (samples.length < 6 && !seen.has(t)) { samples.push(`[id=${k} ${field}] token ${t} EN=${cnt} VI=${vc}`); seen.add(t); } }
          }
          for (const [t, cnt] of tb) if (!ta.has(t)) { tokExtra++; if (samples.length < 6 && !seen.has(t)) { samples.push(`[id=${k} ${field}] token thừa ${t} VI=${cnt}`); seen.add(t); } }
          const na = (ra[field].match(/\n/g) || []).length, nb = (rb[field].match(/\n/g) || []).length;
          if (na !== nb) nlDiff++;
        }
      }
    }
    res.stats.diffFields = fieldDiffs;
    if (tokMiss || tokExtra) { res.warnings.push(`Token lệch: missing=${tokMiss} extra=${tokExtra}`); samples.forEach(s => res.warnings.push('  ' + s)); }
    if (nlDiff) res.warnings.push(`Số dòng \\n lệch ở ${nlDiff} chuỗi (kiểm tra thủ công)`);
  } else {
    res.warnings.push(`Chỉ có nguồn ${srcLang} — đã kiểm tra cấu trúc (record/field), token không đối chiếu được`);
  }
  return res;
}

// ---------- order (work brief) ----------
function printOrder(rels) {
  const c = cfg();
  const g = JSON.parse(fs.readFileSync(GLOSSARY_PATH, 'utf8'));
  for (const rel of rels) {
    const wp = path.join(WORK, rel);
    const dir = path.posix.dirname(rel), base = path.posix.basename(rel);
    const enPath = path.join(c.enDir, dir === '.' ? 'EN_' + base : dir + '/EN_' + base);
    const krPath = path.join(c.krDir, dir === '.' ? 'KR_' + base : dir + '/KR_' + base);
    const info = fs.existsSync(wp) ? readInfo(wp) : { json: null };
    let records = 0, strings = 0;
    if (info.json && Array.isArray(info.json.dataList)) {
      records = info.json.dataList.length;
      const count = (v) => { if (typeof v === 'string') strings++; else if (Array.isArray(v)) v.forEach(count); else if (v && typeof v === 'object') Object.values(v).forEach(count); };
      info.json.dataList.forEach(r => count(r));
    }
    console.log(`\n================ WORK ORDER: ${rel} ================`);
    console.log(`Nhóm: ${classify(rel)} | kích thước: ${fmtSize(fs.existsSync(wp) ? fs.statSync(wp).size : 0)} | records: ${records} | tổng chuỗi: ${strings}`);
    console.log(`Bản gốc EN : ${enPath} ${fs.existsSync(enPath) ? '(có)' : '(KHÔNG có — đối chiếu KR)'}`);
    console.log(`Tham chiếu KR: ${krPath} ${fs.existsSync(krPath) ? '(có)' : '(không)'}`);
    console.log(`\n-- QUY TẮC (bắt buộc) --`);
    g.rules.forEach((r, i) => console.log(`${i + 1}. ${r}`));
    console.log(`\n-- GLOSSARY --`);
    for (const [k, v] of Object.entries(g.terms)) console.log(`  ${k} → ${v}`);
    console.log(`\n-- TEMPLATE SỬA AN TOÀN (copy ra file tạm, sửa REL và mutate) --`);
    console.log(`import fs from 'node:fs';\nconst REL = '${rel}';\nconst p = 'D:/Workspace/Trans Limbus/Work/' + REL;\nconst buf = fs.readFileSync(p);\nconst bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;\nconst text = (bom ? buf.subarray(3) : buf).toString('utf8');\nconst eol = text.includes('\\r\\n') ? '\\r\\n' : '\\n';\nconst m = text.match(/\\n(\\s+)"/);\nconst indent = m ? m[1] : (text.includes('\\n') ? 2 : null);\nconst trailing = text.endsWith('\\n');\nconst json = JSON.parse(text);\nconst ser = j => { let out = JSON.stringify(j, null, indent).split('\\n').join(eol); if (trailing) out += eol; return out; };\nif (ser(json) !== text) { console.error('ROUND-TRIP FAIL — không sửa, báo lại'); process.exit(1); }\nfunction mutate(j) {\n  // SỬA Ở ĐÂY: chỉ đổi giá trị chuỗi, giữ nguyên token/tag/placeholder\n}\nmutate(json);\nfs.writeFileSync(p, bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ser(json), 'utf8')]) : Buffer.from(ser(json), 'utf8'));\nconsole.log('WROTE', REL);`);
    console.log(`\n-- BÁO CÁO LẠI --`);
    console.log(`- Số chuỗi đã sửa; 8-10 ví dụ trước → sau (kèm id/field); các điểm chưa chắc cần người duyệt.`);
  }
}

// ---------- main ----------
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--note') flags.note = rest[++i];
  else if (rest[i] === '--group') flags.group = rest[++i];
  else if (rest[i] === '--order') flags.order = rest[++i];
  else if (rest[i] === '--json') flags.json = true;
  else if (rest[i] === '--force') flags.force = true;
  else args.push(rest[i].replace(/^Work[\\/]/, '').replace(/\\/g, '/'));
}
const nArg = (def) => { const n = parseInt(args.find(a => /^\d+$/.test(a)) || '', 10); return Number.isFinite(n) ? n : def; };

switch (cmd) {
  case 'init': {
    const st = loadState();
    const files = listWork();
    let added = 0, gone = 0;
    for (const rel of files) {
      if (!st.files[rel]) { st.files[rel] = { group: classify(rel), size: fs.statSync(path.join(WORK, rel)).size, status: 'pending', attempts: 0, history: [] }; added++; }
      else {
        st.files[rel].group = classify(rel);
        st.files[rel].size = fs.statSync(path.join(WORK, rel)).size;
        if (!['pending', 'in_progress', 'done', 'failed', 'skipped'].includes(st.files[rel].status)) st.files[rel].status = 'pending';
      }
    }
    for (const rel of Object.keys(st.files)) if (!files.includes(rel) && st.files[rel].status !== 'stale') { st.files[rel].status = 'stale'; gone++; }
    pushEvent(st, 'init', [], `added=${added} stale=${gone}`);
    saveState(st);
    console.log(`init: ${files.length} file | thêm mới: ${added} | đánh dấu stale: ${gone}`);
    break;
  }
  case 'next': {
    const st = requireState();
    const files = pickPending(st, nArg(5), flags.group, flags.order);
    if (flags.json) console.log(JSON.stringify(files, null, 1));
    else files.forEach((f, i) => console.log(`${i + 1}. ${f}  [${st.files[f].group}, ${fmtSize(st.files[f].size)}]`));
    break;
  }
  case 'claim': {
    const st = requireState();
    const explicit = args.filter(a => !/^\d+$/.test(a) && st.files[a]);
    const files = explicit.length ? explicit : pickPending(st, nArg(1), flags.group, flags.order);
    if (!files.length) { console.log('Không còn file pending' + (flags.group ? ' trong nhóm ' + flags.group : '') + '.'); break; }
    const ts = new Date().toISOString();
    for (const f of files) { st.files[f].status = 'in_progress'; st.files[f].started = ts; st.files[f].attempts = (st.files[f].attempts || 0) + 1; st.files[f].history = [...(st.files[f].history || []).slice(-4), { ts, action: 'claim' }]; }
    pushEvent(st, 'claim', files, flags.note || '');
    saveState(st);
    files.forEach(f => console.log(`CLAIMED ${f} [${st.files[f].group}, ${fmtSize(st.files[f].size)}]`));
    break;
  }
  case 'start': case 'done': case 'fail': case 'skip': {
    const st = requireState();
    const map = { start: 'in_progress', done: 'done', fail: 'failed', skip: 'skipped' };
    const ts = new Date().toISOString();
    for (const f of args) {
      if (!st.files[f]) { console.error(`Không có trong progress: ${f}`); process.exitCode = 1; continue; }
      st.files[f].status = map[cmd];
      if (cmd === 'done' || cmd === 'fail' || cmd === 'skip') st.files[f].finished = ts;
      if (flags.note) st.files[f].note = flags.note;
      st.files[f].history = [...(st.files[f].history || []).slice(-4), { ts, action: cmd, note: flags.note || '' }];
    }
    pushEvent(st, cmd, args, flags.note || '');
    saveState(st);
    args.forEach(f => console.log(`${cmd.toUpperCase()}: ${f}${flags.note ? ' — ' + flags.note : ''}`));
    break;
  }
  case 'status': {
    const st = requireState();
    const groups = {};
    for (const [f, e] of Object.entries(st.files)) {
      groups[e.group] = groups[e.group] || { pending: 0, in_progress: 0, done: 0, failed: 0, skipped: 0, stale: 0 };
      groups[e.group][e.status] = (groups[e.group][e.status] || 0) + 1;
    }
    const total = { pending: 0, in_progress: 0, done: 0, failed: 0, skipped: 0, stale: 0 };
    Object.values(groups).forEach(g => Object.keys(total).forEach(k => total[k] += g[k] || 0));
    console.log('TỔNG:', JSON.stringify(total));
    for (const g of GROUP_ORDER) if (groups[g]) console.log(` ${g}: pending=${groups[g].pending} in_progress=${groups[g].in_progress} done=${groups[g].done} failed=${groups[g].failed} skipped=${groups[g].skipped}`);
    const inprog = Object.entries(st.files).filter(([, e]) => e.status === 'in_progress');
    if (inprog.length) { console.log('Đang làm:'); inprog.forEach(([f, e]) => console.log(` - ${f} (từ ${e.started}${e.note ? ', ' + e.note : ''})`)); }
    break;
  }
  case 'info': {
    const st = requireState();
    const f = args[0];
    if (!st.files[f]) { console.error('Không có trong progress: ' + f); process.exit(1); }
    console.log(JSON.stringify(st.files[f], null, 1));
    break;
  }
  case 'verify': {
    if (!args.length) { console.error('Dùng: verify <file...>'); process.exit(1); }
    let errors = 0;
    const results = [];
    for (const f of args) {
      const r = verifyFile(f);
      results.push(r);
      errors += r.errors.length;
      console.log(`\n=== ${f} [${r.stats.srcLang || '?'}] records=${r.stats.viRecords ?? '?'} chuỗi-khác=${r.stats.diffFields ?? '-'}`);
      r.errors.forEach(e => console.log('  ERROR: ' + e));
      r.warnings.forEach(w => console.log('  WARN : ' + w));
      if (!r.errors.length && !r.warnings.length) console.log('  OK');
    }
    if (flags.json) console.log(JSON.stringify(results, null, 1));
    process.exitCode = errors ? 1 : 0;
    break;
  }
  case 'order': {
    if (!args.length) { console.error('Dùng: order <file...>'); process.exit(1); }
    printOrder(args);
    break;
  }
  case 'reset': {
    const st = requireState();
    for (const f of args) {
      if (!st.files[f]) continue;
      st.files[f].status = 'pending';
      st.files[f].history = [...(st.files[f].history || []).slice(-4), { ts: new Date().toISOString(), action: 'reset' }];
    }
    pushEvent(st, 'reset', args, flags.note || '');
    saveState(st);
    console.log('reset:', args.join(', '));
    break;
  }
  default:
    console.log(`Trans Limbus QA progress tool

Cách dùng: node tools/qa/progress.mjs <lệnh> [args]

  init [--force]                 Quét Work/ và khởi tạo/cập nhật progress.json
  next [n] [--group g] [--order size-asc|size-desc]   Xem n file pending tiếp theo (không đổi trạng thái)
  claim [n] [--group g]          Nhận n file pending -> in_progress
  start <file...>                Đánh dấu đang làm
  done <file...> [--note ".."]   Đánh dấu hoàn thành
  fail <file...> [--note ".."]   Đánh dấu cần làm lại
  skip <file...> [--note ".."]   Bỏ qua
  reset <file...>                Về pending
  status                         Thống kê tiến độ
  info <file>                    Chi tiết 1 file
  verify <file...>               Kiểm tra cấu trúc/token so với EN/KR (exit code 1 nếu lỗi cấu trúc)
  order <file...>                In work order đầy đủ (quy tắc + glossary + template sửa)

Nhóm ưu tiên: ${GROUP_ORDER.join(' > ')}`);
}
