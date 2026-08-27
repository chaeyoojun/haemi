const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function arg(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

const out = arg('out', path.join(root, 'releases', 'version.json'));
const notesArg = arg('notes');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
let notes = notesArg;
if (!notes) {
  try {
    notes = JSON.parse(fs.readFileSync(path.join(root, 'releases', 'version.json'), 'utf8')).notes;
  } catch {
    notes = '';
  }
}
if (!notes) {
  notes = '앱을 최신 버전으로 업데이트해 주세요.';
}

const payload = {
  version: app.expo.version,
  versionCode: Number(app.expo.android?.versionCode) || 0,
  notes,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(out);
