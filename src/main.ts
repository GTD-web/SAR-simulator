import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 개발 시 클라이언트(렌더러) 변경 시 창만 새로고침 (앱 전체 재시작 없음)
// main.js, preload.js 변경 시에는 수동으로 앱 재시작 필요
const require = createRequire(import.meta.url);
require('electron-reload')(__dirname, {
  forceHardReset: false,
});

// datetime-local 등 네이티브 date picker를 영어(AM/PM)로 표시
app.commandLine.appendSwitch('lang', 'en-US');
app.commandLine.appendSwitch('accept-lang', 'en-US,en');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1500,
    fullscreen: false, // 시작 시 전체화면
    autoHideMenuBar: true, // 상단 메뉴바 숨기기
    titleBarOverlay: {
      color: '#2a2a2a', // 어두운 배경색
      symbolColor: '#ffffff', // 아이콘 색상 (흰색)
      height: 10,
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Cesium CDN을 사용하기 위해 필요할 수 있습니다
    }
  });

  // index.html과 styles.css가 같은 dist 폴더에 있으므로 상대 경로 사용
  // loadFile은 HTML 파일의 디렉토리를 기준으로 상대 경로를 해석함
  const htmlPath = path.join(__dirname, 'index.html');
  console.log('[Main] Loading HTML from:', htmlPath);
  console.log('[Main] CSS should be at:', path.join(__dirname, 'styles.css'));
  mainWindow.loadFile(htmlPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
