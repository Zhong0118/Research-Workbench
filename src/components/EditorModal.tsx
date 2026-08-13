import { useEffect, useRef, useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useStore, uid } from '../store';
import { Modal } from './Modal';
import type { CustomField, Priority, Status } from '../types';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types';
import type { EditorRequest } from '../editorBus';
import { todayStr } from '../utils';

export function EditorModal({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const { records, types, workspaces, addRecord, updateRecord, deleteRecord } = useStore();
  const existing = request.recordId ? records.find((r) => r.id === request.recordId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [typeId, setTypeId] = useState(existing?.typeId ?? request.typeId ?? types[0]?.id ?? '');
  const [workspaceId, setWorkspaceId] = useState(existing?.workspaceId ?? workspaces[0]?.id ?? '');
  const [status, setStatus] = useState<Status>(existing?.status ?? 'active');
  const [starred, setStarred] = useState(existing?.starred ?? false);
  const [content, setContent] = useState(existing?.content ?? '');
  const [fields, setFields] = useState<CustomField[]>(existing?.fields ?? []);
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'none');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [planDate, setPlanDate] = useState(existing?.planDate ?? request.planDate ?? todayStr());
  const [planStart, setPlanStart] = useState(existing?.planStart ?? '');
  const [planEnd, setPlanEnd] = useState(existing?.planEnd ?? '');
  const [sub, setSub] = useState<'vertical' | 'horizontal'>(existing?.sub ?? 'vertical');

  const kind = types.find((t) => t.id === typeId)?.kind ?? 'generic';

  // 弹窗打开后显式聚焦标题输入框（无边框窗口下 autoFocus 偶发失效）
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const setField = (id: string, patch: Partial<CustomField>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const cleanFields = fields
      .map((f) => ({ ...f, name: f.name.trim(), value: f.value.trim() }))
      .filter((f) => f.name || f.value);
    const patch = {
      title: trimmed,
      typeId,
      workspaceId,
      status,
      starred: kind === 'direction' ? false : starred,
      content,
      fields: cleanFields,
      priority,
      dueDate: dueDate || null,
      planDate: kind === 'schedule' ? planDate || null : null,
      planStart: kind === 'schedule' ? planStart || null : null,
      planEnd: kind === 'schedule' ? planEnd || null : null,
      sub: kind === 'project' ? sub : null,
    };
    if (existing) {
      updateRecord(existing.id, patch);
    } else {
      addRecord(patch);
    }
    onClose();
  };

  const onDelete = () => {
    if (!existing) return;
    if (window.confirm(`确定删除「${existing.title}」吗？此操作不可恢复。`)) {
      deleteRecord(existing.id);
      onClose();
    }
  };

  return (
    <Modal
      title={existing ? '编辑记录' : '新建记录'}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button
              className="btn btn-ghost btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={onDelete}
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
            {existing ? '保存修改' : '创建记录'}
          </button>
        </>
      }
    >
      <div>
        <label className="form-label">标题</label>
        <input
          className="form-input"
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这条记录起个名字"
        />
      </div>

      <div className="form-row">
        <div>
          <label className="form-label">内容类型</label>
          <select className="form-select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">工作区</label>
          <select
            className="form-select"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        {kind === 'todo' ? (
          <>
            <div>
              <label className="form-label">优先级</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">截止日期</label>
              <input
                className="form-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </>
        ) : kind === 'schedule' ? (
          <>
            <div>
              <label className="form-label">计划日期</label>
              <input
                className="form-input"
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">开始（可选）</label>
              <input
                className="form-input"
                type="time"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">结束（可选）</label>
              <input
                className="form-input"
                type="time"
                value={planEnd}
                onChange={(e) => setPlanEnd(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="form-label">状态</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind === 'project' && (
          <div>
            <label className="form-label">项目类别</label>
            <select
              className="form-select"
              value={sub}
              onChange={(e) => setSub(e.target.value as 'vertical' | 'horizontal')}
            >
              <option value="vertical">纵向项目</option>
              <option value="horizontal">横向项目</option>
            </select>
          </div>
        )}
        {kind === 'direction' ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label className="checkline">
              <input
                type="checkbox"
                checked={priority === 'high'}
                onChange={(e) => setPriority(e.target.checked ? 'high' : 'none')}
              />
              <Star size={14} color="#d9a441" fill={priority === 'high' ? '#d9a441' : 'none'} />
              设为主要方向
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label className="checkline">
              <input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} />
              <Star size={14} color="#d9a441" fill={starred ? '#d9a441' : 'none'} />
              设为今日重点
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="form-label">正文 / 心得笔记</label>
        <textarea
          className="form-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录细节、心得、实验现象、灵感……"
        />
      </div>

      <div>
        <label className="form-label">自定义字段（如：项目编号、经费、甲方、会议目标…）</label>
        {fields.map((f) => (
          <div className="field-row" key={f.id}>
            <input
              className="form-input name"
              value={f.name}
              onChange={(e) => setField(f.id, { name: e.target.value })}
              placeholder="字段名"
            />
            <input
              className="form-input"
              value={f.value}
              onChange={(e) => setField(f.id, { value: e.target.value })}
              placeholder="字段值"
            />
            <button
              className="icon-btn danger"
              onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}
              title="删除字段"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setFields((fs) => [...fs, { id: uid(), name: '', value: '' }])}
        >
          <Plus size={14} />
          添加字段
        </button>
      </div>
    </Modal>
  );
}
