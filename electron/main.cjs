const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = app.isPackaged ? undefined : process.env.ELECTRON_START_URL;

// 单实例：托盘驻留时再次点击快捷方式，只唤出已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWin = null;
let tray = null;
let isQuitting = false;

function isTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  try {
    const actual = new URL(senderUrl);
    if (app.isPackaged) return actual.protocol === 'file:';
    return Boolean(DEV_URL && actual.origin === new URL(DEV_URL).origin);
  } catch {
    return false;
  }
}

function onTrusted(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) listener(event, ...args);
  });
}

function handleTrusted(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Blocked IPC from an untrusted sender');
    return listener(event, ...args);
  });
}

// 主进程侧的轻量设置（关窗行为等），持久化到 userData
const settingsFile = () => path.join(app.getPath('userData'), 'app-settings.json');

function readSettings() {
  try {
    return { closeToTray: true, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { closeToTray: true };
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  } catch {
    // userData 不可写时静默降级，本次运行内仍生效
  }
  return next;
}

function trayIcon() {
  const p = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
  return nativeImage.createFromPath(p);
}

function showMainWindow() {
  if (!mainWin) {
    createWindow();
    return;
  }
  mainWin.show();
  mainWin.focus();
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Research Workbench · 科研工作台');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示科研工作台', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', showMainWindow);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Research Workbench · 科研工作台',
    backgroundColor: '#f6f3ec',
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWin = win;

  // 关闭 = 最小化到托盘（可在设置中关掉）；真正退出走托盘菜单
  win.on('close', (e) => {
    if (!isQuitting && readSettings().closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    if (mainWin === win) mainWin = null;
  });

  // 外部链接交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url).catch(() => {});
    } catch {
      // Ignore malformed external URLs.
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

onTrusted('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
onTrusted('win:toggle-maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
});
onTrusted('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

// 开机自启（Windows 登录项）
handleTrusted('app:get-auto-launch', () => app.getLoginItemSettings().openAtLogin);
handleTrusted('app:set-auto-launch', (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
});

// 关闭时最小化到托盘
handleTrusted('app:get-close-to-tray', () => readSettings().closeToTray);
handleTrusted('app:set-close-to-tray', (_e, enabled) => {
  return writeSettings({ closeToTray: Boolean(enabled) }).closeToTray;
});

app.whenReady().then(() => {
  createTray();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => showMainWindow());

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
