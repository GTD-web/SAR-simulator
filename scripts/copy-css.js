import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcCssFile = path.join(__dirname, '../src/styles.css');
const destCssFile = path.join(__dirname, '../dist/styles.css');
const srcHtmlFile = path.join(__dirname, '../index.html');
const destHtmlFile = path.join(__dirname, '../dist/index.html');
const srcAssetsDir = path.join(__dirname, '../src/assets');
const destAssetsDir = path.join(__dirname, '../dist/assets');

function copyAssets() {
  if (!fs.existsSync(srcAssetsDir)) return;
  if (!fs.existsSync(destAssetsDir)) fs.mkdirSync(destAssetsDir, { recursive: true });
  for (const file of fs.readdirSync(srcAssetsDir)) {
    fs.copyFileSync(path.join(srcAssetsDir, file), path.join(destAssetsDir, file));
  }
  console.log('✓ assets 복사 완료: src/assets -> dist/assets');
}

try {
  const distDir = path.dirname(destCssFile);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.copyFileSync(srcCssFile, destCssFile);
  console.log('✓ CSS 파일 복사 완료: src/styles.css -> dist/styles.css');
  
  fs.copyFileSync(srcHtmlFile, destHtmlFile);
  console.log('✓ HTML 파일 복사 완료: index.html -> dist/index.html');

  copyAssets();
} catch (error) {
  console.error('✗ 파일 복사 실패:', error.message);
  process.exit(1);
}
