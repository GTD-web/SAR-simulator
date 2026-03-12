import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcCssFile = path.join(__dirname, '../src/styles.css');
const destCssFile = path.join(__dirname, '../dist/styles.css');
const srcHtmlFile = path.join(__dirname, '../index.html');
const destHtmlFile = path.join(__dirname, '../dist/index.html');

const DEBOUNCE_MS = 100;

let copyTimeout = null;

function copyFiles() {
  try {
    if (fs.existsSync(srcCssFile)) {
      fs.copyFileSync(srcCssFile, destCssFile);
      console.log('✓ CSS 파일 복사 완료:', new Date().toLocaleTimeString());
    }
    if (fs.existsSync(srcHtmlFile)) {
      fs.copyFileSync(srcHtmlFile, destHtmlFile);
      console.log('✓ HTML 파일 복사 완료:', new Date().toLocaleTimeString());
    }
  } catch (error) {
    console.error('✗ 파일 복사 실패:', error.message);
  }
}

function scheduleCopy() {
  if (copyTimeout) clearTimeout(copyTimeout);
  copyTimeout = setTimeout(() => {
    copyFiles();
    copyTimeout = null;
  }, DEBOUNCE_MS);
}

// 초기 복사
copyFiles();

// chokidar: Windows에서 안정적인 파일 감시
const watcher = chokidar.watch([srcCssFile, srcHtmlFile], {
  persistent: true,
  ignoreInitial: true,
});
watcher.on('change', scheduleCopy);
watcher.on('add', scheduleCopy);
console.log('👀 CSS/HTML 파일 변경 감지 시작 (chokidar)...');
