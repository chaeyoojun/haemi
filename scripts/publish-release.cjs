const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const flags = new Set(process.argv.slice(2));
const wantApk = flags.has('--apk') || (!flags.has('--ipa') && !flags.has('--apk'));
const wantIpa = flags.has('--ipa') || (!flags.has('--ipa') && !flags.has('--apk'));
const notes = process.env.PUBLISH_NOTES || '앱 업데이트';
const serverHost = process.env.HAEMI_SERVER_HOST || '121.78.183.225';
const sshUser = process.env.HAEMI_SSH_USER || 'ubuntu';
const remoteDir = process.env.HAEMI_REMOTE_DIR || '~/haemi';
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const version = appJson.expo.version;
const versionCode = Number(appJson.expo.android?.versionCode) || 0;
const apk = path.join(root, 'dist', 'haemi.apk');
const ipa = path.join(root, 'dist', 'haemi.ipa');

function findKey() {
  const candidates = [
    process.env.HAEMI_SSH_KEY,
    'C:\\workspace\\toolloop\\SSH_KeyPair-260716092832.pem',
    path.join(os.homedir(), '.ssh', 'SSH_KeyPair-260716092832.pem'),
    path.join(os.homedir(), 'SSH_KeyPair-260716092832.pem'),
    path.join(root, 'SSH_KeyPair-260716092832.pem'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'SSH 키를 찾지 못했습니다. HAEMI_SSH_KEY 환경변수에 PEM 경로를 넣으세요.'
    );
  }
  return found;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

const uploads = [];
if (wantApk && fs.existsSync(apk)) {
  uploads.push({ local: apk, remote: 'hmfpv.apk' });
} else if (flags.has('--apk')) {
  throw new Error(`APK가 없습니다. 먼저 npm run apk 를 실행하세요: ${apk}`);
}
if (wantIpa && fs.existsSync(ipa)) {
  uploads.push({ local: ipa, remote: 'hmfpv.ipa' });
} else if (flags.has('--ipa')) {
  throw new Error(`IPA가 없습니다. 맥북에서 npm run ipa 를 실행하세요: ${ipa}`);
}
if (!uploads.length) {
  throw new Error('업로드할 APK/IPA가 없습니다.');
}

const keyPath = findKey();
const target = `${sshUser}@${serverHost}`;
const sshBase = ['-i', keyPath, '-o', 'StrictHostKeyChecking=accept-new'];
const versionFile = path.join(os.tmpdir(), 'haemi-version.json');
fs.writeFileSync(
  versionFile,
  `${JSON.stringify({ version, versionCode, notes })}\n`
);

run('ssh', [...sshBase, target, `mkdir -p ${remoteDir}/releases`]);
for (const file of uploads) {
  run('scp', [...sshBase, file.local, `${target}:${remoteDir}/releases/${file.remote}`]);
}
run('scp', [...sshBase, versionFile, `${target}:${remoteDir}/releases/version.json`]);
fs.rmSync(versionFile, { force: true });

console.log(`published ${version} (${versionCode})`);
console.log('  https://if.io.kr/haemi-api/app');
if (uploads.some((file) => file.remote.endsWith('.apk'))) {
  console.log('  https://if.io.kr/haemi-api/api/app/hmfpv.apk');
}
if (uploads.some((file) => file.remote.endsWith('.ipa'))) {
  console.log('  https://if.io.kr/haemi-api/api/app/hmfpv.ipa');
}
