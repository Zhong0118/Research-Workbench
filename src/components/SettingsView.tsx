import { useEffect, useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Plus, Power } from 'lucide-react';
import { useStore } from '../store';
import { InlineNotes } from './MusicNotes';
import { rw } from '../platform';

function TypeManager() {
  const { types, records, addType, renameType, deleteType } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'generic' | 'todo'>('generic');

  return (
    <div className="card settings-section">
      <h3>内容类型</h3>
      <p className="desc">所有类型都可重命名、删除，也可新增自定义类型。删除类型会同时移除其下的全部记录，请谨慎操作。</p>
      {types.map((t) => {
        const count = records.filter((r) => r.typeId === t.id).length;
        return (
          <div className="manage-row" key={t.id}>
            <span className="notes-inline type-note" style={{ letterSpacing: '0.1em' }}>
              {t.note}
            </span>
            <input
              className="form-input"
              defaultValue={t.name}
              key={t.id + t.name}
              onBlur={(e) => e.target.value !== t.name && renameType(t.id, e.target.value)}
            />
            <span className="field-chip">
              {t.kind === 'todo'
                ? '待办'
                : t.kind === 'schedule'
                  ? '日程'
                  : t.kind === 'direction'
                    ? '方向'
                    : t.kind === 'project'
                      ? '项目'
                      : '通用'}
            </span>
            <span className="field-chip">{count} 条</span>
            <button
              className="icon-btn danger"
              title="删除类型"
              onClick={() =>
                window.confirm(`删除类型「${t.name}」将同时删除其 ${count} 条记录，确定？`) &&
                deleteType(t.id)
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
      <div className="add-row">
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新类型名称，如「专利」「学术兼职」"
        />
        <select
          className="form-select"
          style={{ maxWidth: 120 }}
          value={kind}
          onChange={(e) => setKind(e.target.value as 'generic' | 'todo')}
        >
          <option value="generic">通用</option>
          <option value="todo">待办</option>
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            addType(name, kind);
            setName('');
          }}
        >
          <Plus size={14} />
          添加
        </button>
      </div>
    </div>
  );
}

function WorkspaceManager() {
  const { workspaces, records, addWorkspace, renameWorkspace, deleteWorkspace } = useStore();
  const [name, setName] = useState('');

  return (
    <div className="card settings-section">
      <h3>工作区</h3>
      <p className="desc">工作区用于分隔不同环境（如「课题组」「个人」）。删除工作区后，其记录会移入默认工作区。</p>
      {workspaces.map((w) => (
        <div className="manage-row" key={w.id}>
          <input
            className="form-input"
            defaultValue={w.name}
            key={w.id + w.name}
            onBlur={(e) => e.target.value !== w.name && renameWorkspace(w.id, e.target.value)}
          />
          <span className="field-chip">{records.filter((r) => r.workspaceId === w.id).length} 条</span>
          {w.builtin ? (
            <span className="field-chip">内置</span>
          ) : (
            <button
              className="icon-btn danger"
              title="删除工作区"
              onClick={() => window.confirm(`确定删除工作区「${w.name}」？`) && deleteWorkspace(w.id)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      <div className="add-row">
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新工作区名称"
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            addWorkspace(name);
            setName('');
          }}
        >
          <Plus size={14} />
          添加
        </button>
      </div>
    </div>
  );
}

function DataManager() {
  const { exportData, importData, resetSample } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const onExport = () => {
    const payload = exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `research-workbench-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('已导出 JSON 备份。');
  };

  const onImport = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setMessage('导入失败：备份文件不能超过 10 MB。');
      return;
    }
    try {
      const text = await file.text();
      const result = importData(JSON.parse(text));
      setMessage(result.ok ? '导入成功，数据已恢复。' : `导入失败：${result.error}`);
    } catch {
      setMessage('导入失败：文件不是有效的 JSON。');
    }
  };

  return (
    <div className="card settings-section">
      <h3>数据管理</h3>
      <p className="desc">全部数据保存在本机浏览器存储中，无需账号与网络。换机或重装前请先导出备份。</p>
      <div className="data-actions">
        <button className="btn btn-ghost" onClick={onExport}>
          <Download size={15} />
          导出 JSON 备份
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          导入 JSON
        </button>
        <button
          className="btn btn-ghost btn-danger"
          onClick={() =>
            window.confirm('将清空当前全部数据并恢复示例数据，确定？') && resetSample()
          }
        >
          <RotateCcw size={15} />
          恢复示例数据
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>{message}</p>}
    </div>
  );
}

function ProfileManager() {
  const { displayName, setDisplayName } = useStore();

  return (
    <div className="card settings-section">
      <h3>个性化</h3>
      <p className="desc">总览页问候语中的显示名，留空则只显示问候。</p>
      <input
        className="form-input"
        defaultValue={displayName}
        key={displayName}
        onBlur={(e) => e.target.value.trim() !== displayName && setDisplayName(e.target.value)}
        placeholder="输入显示名"
      />
    </div>
  );
}

function LaunchManager() {
  const supported = typeof rw?.getAutoLaunch === 'function';
  const [on, setOn] = useState(false);
  const [tray, setTray] = useState(true);

  useEffect(() => {
    rw?.getAutoLaunch?.().then(setOn).catch(() => undefined);
    rw?.getCloseToTray?.().then(setTray).catch(() => undefined);
  }, []);

  const toggle = async (enabled: boolean) => {
    setOn(enabled);
    if (!supported) return;
    try {
      setOn(await rw!.setAutoLaunch!(enabled));
    } catch {
      setOn(!enabled);
    }
  };

  const toggleTray = async (enabled: boolean) => {
    setTray(enabled);
    if (!supported) return;
    try {
      setTray(await rw!.setCloseToTray!(enabled));
    } catch {
      setTray(!enabled);
    }
  };

  return (
    <div className="card settings-section">
      <h3>
        <Power size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        启动
      </h3>
      <p className="desc">自启与后台运行设置（仅桌面安装版生效）。后台运行时，窗口关闭后会驻留托盘，右键托盘图标可退出。</p>
      <label className="checkline">
        <input
          type="checkbox"
          checked={on}
          disabled={!supported}
          onChange={(e) => toggle(e.target.checked)}
        />
        开机自动启动
        {!supported && <span className="field-chip">浏览器预览中不可用</span>}
      </label>
      <label className="checkline">
        <input
          type="checkbox"
          checked={tray}
          disabled={!supported}
          onChange={(e) => toggleTray(e.target.checked)}
        />
        关闭窗口时后台运行（最小化到托盘）
      </label>
    </div>
  );
}

export function SettingsView() {
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">
          设置与数据 <InlineNotes text="♪" />
        </h1>
      </div>
      <div className="settings-grid">
        <TypeManager />
        <WorkspaceManager />
        <DataManager />
        <LaunchManager />
        <ProfileManager />
        <div className="card settings-section">
          <h3>关于</h3>
          <p className="desc" style={{ marginBottom: 0 }}>
            Research Workbench · 科研工作台 · Release 版 —— 本地优先，数据完全属于你自己。
          </p>
          <div className="about-notes">♪ 𝄞 ♫ ♩ 𝅘𝅥 ♬</div>
        </div>
      </div>
    </div>
  );
}
