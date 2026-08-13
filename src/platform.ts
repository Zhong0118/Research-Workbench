export interface RwWindowApi {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getCloseToTray: () => Promise<boolean>;
  setCloseToTray: (enabled: boolean) => Promise<boolean>;
}

/** Electron 预加载暴露的窗口/系统能力；浏览器预览时为 undefined */
export const rw = (window as unknown as { rwWindow?: RwWindowApi }).rwWindow;
