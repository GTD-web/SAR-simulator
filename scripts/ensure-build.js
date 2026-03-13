/**
 * dist/main.js 존재 여부 확인. 없으면 클린 빌드 수행.
 * (증분 빌드 캐시 꼬임 또는 dist 미생성 시 대비)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distMain = path.join(__dirname, '../dist/main.js');
const tsbuildinfo = path.join(__dirname, '../tsconfig.tsbuildinfo');
const distDir = path.join(__dirname, '../dist');

if (!fs.existsSync(distMain)) {
  console.log('[ensure-build] dist/main.js 없음. 클린 빌드 수행...');
  try {
    if (fs.existsSync(tsbuildinfo)) {
      fs.unlinkSync(tsbuildinfo);
    }
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true });
    }
    execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error('[ensure-build] 빌드 실패:', err.message);
    process.exit(1);
  }
}
