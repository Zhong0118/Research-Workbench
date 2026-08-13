import { Minus, Square, X } from 'lucide-react';
import { rw } from '../platform';
import logo from '../assets/logo.png';

/** 自定义宽标题栏：品牌 + 拖拽区 + 窗口控制（浏览器预览时仅显示品牌条） */
export function TitleBar() {
  return (
    <header className="titlebar" onDoubleClick={() => rw?.toggleMaximize()}>
      <div className="titlebar-brand">
        <img className="titlebar-logo" src={logo} alt="" />
        <span className="titlebar-title serif">Research Workbench · 科研工作台</span>
        <span className="titlebar-notes" aria-hidden>
          ♪ 𝄞 ♫
        </span>
      </div>
      {rw && (
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => rw?.minimize()} aria-label="最小化">
            <Minus size={15} />
          </button>
          <button className="tb-btn" onClick={() => rw?.toggleMaximize()} aria-label="最大化 / 还原">
            <Square size={13} />
          </button>
          <button className="tb-btn tb-close" onClick={() => rw?.close()} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
