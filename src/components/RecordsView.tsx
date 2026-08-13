import { useMemo, useState, Fragment } from 'react';
import type { DragEvent } from 'react';
import clsx from 'clsx';
import { Plus, GripVertical, Pencil, Copy, Archive, Trash2, Star } from 'lucide-react';
import { useStore, selectFiltered } from '../store';
import { STATUS_LABEL } from '../types';
import type { RecordItem } from '../types';
import { RecordRow, StatusPill } from './RecordRow';
import type { RowDnd } from './RecordRow';
import { Empty } from './Dashboard';
import { InlineNotes } from './MusicNotes';
import { requestEditor } from '../editorBus';
import { orderKey } from '../planUtils';
import { formatDate } from '../utils';

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'planned', label: STATUS_LABEL.planned },
  { key: 'active', label: STATUS_LABEL.active },
  { key: 'paused', label: STATUS_LABEL.paused },
  { key: 'done', label: STATUS_LABEL.done },
  { key: 'archived', label: '已归档' },
];

/** 科研方向专用宽卡片：主次优先级 + 多行正文 + 竖排自定义字段 */
function DirectionCard({ record, dnd }: { record: RecordItem; dnd: RowDnd }) {
  const { workspaces, archiveRecord, duplicateRecord, deleteRecord, updateRecord } = useStore();
  const ws = workspaces.find((w) => w.id === record.workspaceId);
  const isMain = record.priority === 'high';

  const onDelete = () => {
    if (window.confirm(`确定删除「${record.title}」吗？此操作不可恢复。`)) {
      deleteRecord(record.id);
    }
  };

  return (
    <div
      className={clsx('card record-card', dnd.className)}
      draggable
      onDragStart={dnd.onDragStart}
      onDragEnd={dnd.onDragEnd}
      onDragOver={dnd.onDragOver}
      onDragLeave={dnd.onDragLeave}
      onDrop={dnd.onDrop}
    >
      <div className="rc-head">
        <GripVertical size={14} className="grip rc-grip" />
        <button
          className={clsx('star-btn', isMain && 'on')}
          onClick={() => updateRecord(record.id, { priority: isMain ? 'none' : 'high' })}
          title={isMain ? '主要方向（点击降为次要）' : '设为主要方向'}
        >
          <Star size={16} fill={isMain ? 'currentColor' : 'none'} />
        </button>
        <div
          className="rc-title serif"
          onClick={() => requestEditor({ recordId: record.id })}
          role="button"
          tabIndex={0}
        >
          {record.title}
        </div>
        <div className="rc-actions">
          <button className="icon-btn" title="编辑" onClick={() => requestEditor({ recordId: record.id })}>
            <Pencil size={15} />
          </button>
          <button className="icon-btn" title="复制" onClick={() => duplicateRecord(record.id)}>
            <Copy size={15} />
          </button>
          <button
            className="icon-btn"
            title={record.archived ? '取消归档' : '归档'}
            onClick={() => archiveRecord(record.id, !record.archived)}
          >
            <Archive size={15} />
          </button>
          <button className="icon-btn danger" title="删除" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {record.content && <div className="rc-content">{record.content}</div>}
      {record.fields.length > 0 && (
        <div className="rc-fields">
          {record.fields.map((f) => (
            <div className="rc-field" key={f.id}>
              <b>{f.name}</b>
              <span>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="rc-foot">
        {record.archived ? (
          <span className="pill pill-archived">已归档</span>
        ) : (
          <StatusPill status={record.status} />
        )}
        {ws && <span>{ws.name}</span>}
        <span style={{ marginLeft: 'auto' }}>更新于 {formatDate(record.updatedAt)}</span>
      </div>
    </div>
  );
}

export function RecordsView({ typeId }: { typeId: string }) {
  const state = useStore();
  const { types, statusFilter, setStatusFilter, reorderRecord } = state;
  const type = types.find((t) => t.id === typeId);

  const records = useMemo(() => selectFiltered(state, typeId), [state, typeId]);

  // 手动排序（order）优先，未设置时按更新时间倒序兜底；科研方向：主要方向在前
  const sorted = useMemo(() => {
    const list = [...records].sort((a, b) => orderKey(a) - orderKey(b));
    if (type?.kind === 'direction') {
      return list
        .filter((r) => r.priority === 'high')
        .concat(list.filter((r) => r.priority !== 'high'));
    }
    return list;
  }, [records, type?.kind]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);

  // 科研项目：按纵向 / 横向细分分组（组内保持手动排序）
  const subGroups = useMemo(() => {
    if (type?.kind !== 'project') return [];
    const vertical = sorted.filter((r) => r.sub === 'vertical');
    const horizontal = sorted.filter((r) => r.sub === 'horizontal');
    const other = sorted.filter((r) => r.sub !== 'vertical' && r.sub !== 'horizontal');
    return [
      { key: 'vertical', label: '纵向项目', items: vertical },
      { key: 'horizontal', label: '横向项目', items: horizontal },
      { key: 'other', label: '未分类', items: other },
    ].filter((g) => g.items.length > 0);
  }, [type?.kind, sorted]);

  if (!type) return null;

  const isDirection = type.kind === 'direction';
  const isProject = type.kind === 'project';

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  /** 卡片网格：上沿 30% 插前，下沿 30% 插后，中间带按横向中点；横版行：纵向中点 */
  const dropAfter = (e: DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!isDirection) return e.clientY > rect.top + rect.height / 2;
    const cy = (e.clientY - rect.top) / rect.height;
    const cx = (e.clientX - rect.left) / rect.width;
    return cy < 0.3 ? false : cy > 0.7 ? true : cx > 0.5;
  };

  const dndFor = (r: RecordItem): RowDnd => ({
    className: clsx(
      dragId === r.id && 'dragging',
      over?.id === r.id && (over.after ? 'drop-after' : 'drop-before'),
    ),
    onDragStart: (e) => {
      setDragId(r.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: endDrag,
    onDragOver: (e) => {
      if (!dragId || dragId === r.id) return;
      e.preventDefault();
      setOver({ id: r.id, after: dropAfter(e) });
    },
    onDragLeave: () => setOver((o) => (o?.id === r.id ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      if (dragId && dragId !== r.id) reorderRecord(dragId, r.id, dropAfter(e));
      endDrag();
    },
  });

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            {type.name} <InlineNotes text={type.note} />
          </h1>
          <p className="page-desc">共 {sorted.length} 条记录 · 拖动可调整顺序</p>
        </div>
        <button className="btn btn-primary" onClick={() => requestEditor({ typeId })}>
          <Plus size={15} />
          新建{type.name}
        </button>
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Empty text={`暂无${statusFilter === 'all' ? '' : '该状态下的'}${type.name}记录`} />
      ) : isDirection ? (
        <div className="record-grid">
          {sorted.map((r) => (
            <DirectionCard key={r.id} record={r} dnd={dndFor(r)} />
          ))}
        </div>
      ) : isProject ? (
        <div>
          {subGroups.map((g) => (
            <Fragment key={g.key}>
              <h2 className="section-title proj-group">{g.label}</h2>
              <div className="record-list">
                {g.items.map((r) => (
                  <RecordRow key={r.id} record={r} dnd={dndFor(r)} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="record-list">
          {sorted.map((r) => (
            <RecordRow key={r.id} record={r} dnd={dndFor(r)} />
          ))}
        </div>
      )}
    </div>
  );
}
