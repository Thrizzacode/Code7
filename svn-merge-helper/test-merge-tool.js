/**
 * Manual verification script for _getConflictFiles + launchExternalTool.
 * Run: node test-merge-tool.js
 */

const Module = require('module');
const path = require('path');
const { EventEmitter } = require('events');

// ─── SVN XML fixtures ────────────────────────────────────────────────────────

const WITH_CONFLICT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<info>
<entry kind="file" path="C:\\repo\\src\\app.js" revision="456">
<wc-info>
  <conflict>
    <prev-base-file>app.js.r123</prev-base-file>
    <cur-base-file>app.js.r456</cur-base-file>
    <prev-wc-file>app.js.mine</prev-wc-file>
  </conflict>
</wc-info>
</entry>
</info>`;

const NO_CONFLICT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<info>
<entry kind="file" path="C:\\repo\\src\\app.js" revision="456">
<wc-info>
</wc-info>
</entry>
</info>`;

// ─── Mock state ──────────────────────────────────────────────────────────────

let svnXmlResponse = WITH_CONFLICT_XML;
let svnShouldFail = false;
const spawnCalls = [];

function makeFakeChild() {
  const emitter = new EventEmitter();
  emitter.unref = () => {};
  process.nextTick(() => emitter.emit('close', 0));
  return emitter;
}

const mockChildProcess = {
  execFile(cmd, args, opts, callback) {
    if (svnShouldFail) {
      callback(new Error('svn: command not found'), '', 'svn: command not found');
      return;
    }
    callback(null, svnXmlResponse, '');
  },
  spawn(cmd, args) {
    spawnCalls.push({ cmd, args: [...args] });
    return makeFakeChild();
  },
};

// ─── Intercept require('child_process') before loading svn-bridge ────────────

const originalLoad = Module._load.bind(Module);
Module._load = function (request, parent, isMain) {
  if (request === 'child_process') return mockChildProcess;
  return originalLoad(request, parent, isMain);
};

const SvnBridge = require('./src/main/svn-bridge');

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passed++;
  } else {
    console.error(`  ✗  ${message}`);
    failed++;
  }
}

function reset() {
  svnXmlResponse = WITH_CONFLICT_XML;
  svnShouldFail = false;
  spawnCalls.length = 0;
}

// ─── Test cases ──────────────────────────────────────────────────────────────

const FILE_PATH = 'C:\\repo\\src\\app.js';
const DIR = path.dirname(FILE_PATH);
const TOOL_PATH = 'C:\\Program Files\\TortoiseSVN\\bin\\TortoiseMerge.exe';

async function run() {
  // ── 1. 正常衝突 XML → 回傳三個正確路徑 ──────────────────────────────────
  console.log('\n[1] _getConflictFiles — 有衝突資訊');
  reset();
  const r1 = await SvnBridge._getConflictFiles(FILE_PATH);
  assert(r1 !== null, '回傳非 null');
  assert(r1?.base   === path.resolve(DIR, 'app.js.r123'), `base   = ${r1?.base}`);
  assert(r1?.theirs === path.resolve(DIR, 'app.js.r456'), `theirs = ${r1?.theirs}`);
  assert(r1?.mine   === path.resolve(DIR, 'app.js.mine'), `mine   = ${r1?.mine}`);

  // ── 2. 無 conflict 節點 → 回傳 null ─────────────────────────────────────
  console.log('\n[2] _getConflictFiles — XML 無衝突節點');
  reset(); svnXmlResponse = NO_CONFLICT_XML;
  const r2 = await SvnBridge._getConflictFiles(FILE_PATH);
  assert(r2 === null, '回傳 null');

  // ── 3. SVN 指令失敗 → 安全回傳 null，不拋例外 ───────────────────────────
  console.log('\n[3] _getConflictFiles — SVN 指令失敗');
  reset(); svnShouldFail = true;
  const r3 = await SvnBridge._getConflictFiles(FILE_PATH);
  assert(r3 === null, '不拋例外，安全回傳 null');

  // ── 4. launchExternalTool — 有衝突資訊 → 帶完整參數呼叫 TortoiseMerge ──
  console.log('\n[4] launchExternalTool — 有衝突資訊');
  reset();
  await SvnBridge.launchExternalTool(TOOL_PATH, FILE_PATH);
  assert(spawnCalls.length === 1, 'spawn 呼叫一次');
  const args4 = spawnCalls[0]?.args ?? [];
  const get = (prefix) => args4.find(a => a.startsWith(prefix));
  assert(!!get('/base:'),   `/base:   存在 → ${get('/base:')}`);
  assert(!!get('/theirs:'), `/theirs: 存在 → ${get('/theirs:')}`);
  assert(!!get('/mine:'),   `/mine:   存在 → ${get('/mine:')}`);
  assert(get('/merged:') === `/merged:${FILE_PATH}`, `/merged: 指向衝突檔 → ${get('/merged:')}`);
  assert(get('/base:')   === `/base:${path.resolve(DIR, 'app.js.r123')}`,   `/base:   路徑正確`);
  assert(get('/theirs:') === `/theirs:${path.resolve(DIR, 'app.js.r456')}`, `/theirs: 路徑正確`);
  assert(get('/mine:')   === `/mine:${path.resolve(DIR, 'app.js.mine')}`,   `/mine:   路徑正確`);

  // ── 5. launchExternalTool — 無衝突資訊 → fallback 只傳 filePath ─────────
  console.log('\n[5] launchExternalTool — 無衝突資訊 (fallback)');
  reset(); svnXmlResponse = NO_CONFLICT_XML;
  await SvnBridge.launchExternalTool(TOOL_PATH, FILE_PATH);
  assert(spawnCalls.length === 1, 'spawn 呼叫一次');
  const args5 = spawnCalls[0]?.args ?? [];
  assert(args5.length === 1,          `只傳一個參數`);
  assert(args5[0] === FILE_PATH,      `該參數為 filePath → ${args5[0]}`);

  // ── 6. launchExternalTool — SVN 失敗 → 同樣 fallback ────────────────────
  console.log('\n[6] launchExternalTool — SVN 失敗時 fallback');
  reset(); svnShouldFail = true;
  await SvnBridge.launchExternalTool(TOOL_PATH, FILE_PATH);
  const args6 = spawnCalls[0]?.args ?? [];
  assert(args6.length === 1 && args6[0] === FILE_PATH, 'SVN 失敗時仍以 fallback 啟動工具');

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(45)}`);
  console.log(`結果: ${passed} 通過　${failed} 失敗`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\n執行錯誤:', err);
  process.exit(1);
});
