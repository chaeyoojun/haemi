const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const iosDir = path.join(root, 'ios');
const distDir = path.join(root, 'dist');
const archivePath = path.join(distDir, 'HMFPV.xcarchive');
const exportDir = path.join(distDir, 'ios-export');
const exportPlist = path.join(distDir, 'ExportOptions.plist');
const copied = path.join(distDir, 'haemi.ipa');
const openXcode = process.argv.includes('--open');
const scheme = 'HMFPV';

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
    ...options,
  });
}

if (process.platform !== 'darwin') {
  throw new Error('iOS IPA는 macOS에서만 빌드할 수 있습니다.');
}

const xcodebuild = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcodebuild.status !== 0) {
  throw new Error('Xcode가 없습니다. App Store에서 Xcode를 설치한 뒤 다시 실행하세요.');
}

process.chdir(root);
fs.mkdirSync(distDir, { recursive: true });

run('npx expo prebuild --platform ios --non-interactive');

const workspace = path.join(iosDir, `${scheme}.xcworkspace`);
if (!fs.existsSync(workspace)) {
  throw new Error(`Xcode workspace가 없습니다: ${workspace}`);
}

if (openXcode) {
  run('xed ios');
  console.log('\nXcode에서 Team을 선택한 뒤 Product > Archive 로 IPA를 만들면 됩니다.');
  console.log('Archive가 끝나면 dist/haemi.ipa 로 복사하고 npm run publish-ipa 를 실행하세요.');
  process.exit(0);
}

const method = process.env.IPA_EXPORT_METHOD || 'ad-hoc';
const teamId = process.env.APPLE_TEAM_ID || '';
const teamEntry = teamId
  ? `  <key>teamID</key>\n  <string>${teamId}</string>\n`
  : '';

fs.writeFileSync(
  exportPlist,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${method}</string>
  <key>signingStyle</key>
  <string>automatic</string>
${teamEntry}  <key>compileBitcode</key>
  <false/>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
`
);

const extraSign = ['-allowProvisioningUpdates'];
if (teamId) {
  extraSign.push(`DEVELOPMENT_TEAM=${teamId}`, 'CODE_SIGN_STYLE=Automatic');
}

try {
  run(
    [
      'xcodebuild',
      `-workspace "${scheme}.xcworkspace"`,
      `-scheme "${scheme}"`,
      '-configuration Release',
      `-destination "generic/platform=iOS"`,
      `-archivePath "${archivePath}"`,
      'archive',
      ...extraSign,
    ].join(' '),
    { cwd: iosDir }
  );

  fs.rmSync(exportDir, { recursive: true, force: true });
  fs.mkdirSync(exportDir, { recursive: true });

  run(
    [
      'xcodebuild',
      '-exportArchive',
      `-archivePath "${archivePath}"`,
      `-exportPath "${exportDir}"`,
      `-exportOptionsPlist "${exportPlist}"`,
      ...extraSign,
    ].join(' ')
  );
} catch (error) {
  console.error('\n자동 서명이 실패했습니다. Xcode에서 팀을 지정한 뒤 다시 빌드하세요:');
  console.error('  npm run ipa:open');
  console.error('또는 APPLE_TEAM_ID=팀ID npm run ipa');
  throw error;
}

const ipa = fs.readdirSync(exportDir).find((name) => name.endsWith('.ipa'));
if (!ipa) {
  throw new Error(`IPA를 찾지 못했습니다: ${exportDir}`);
}

fs.copyFileSync(path.join(exportDir, ipa), copied);
console.log('\nIPA ready:');
console.log(`  ${copied}`);
console.log('\n업로드:');
console.log('  npm run publish-ipa');
