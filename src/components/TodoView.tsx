import { useMemo, useState } from 'react';
import { Plus, Star, Trash2, Calendar } from 'lucide-react';
import { useStore, selectFiltered } from '../store';
import type { RecordItem } from '../types';
import { InlineNotes } from './MusicNotes';
import { Empty } from './Dashboard';
import { requestEditor } from '../editorBus';
import { daysFromToday, todayStr } from '../utils';
import clsx from 'clsx';

type Tab = 'today' | 'starred' | 'all' | 'done';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'today', label: '我的一天' },
  { key: 'starred', label: '重要' },
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' },
];

function DueBadge({ dueDate }: { dueDate: string }) {
  const diff = daysFromToday(dueDate);
  const label = diff < 0 ? `已过期 ${-diff} 天` : diff === 0 ? '今天' : diff === 1 ? '明天' : dueDate;
  return (
    <span className={clsx('due-badge', diff < 0 && 'overdue', diff === 0 && 'today')}>
      <Calendar size={12} />
      {label}
    </span>
  );
}

function TodoItem({ record }: { record: RecordItem }) {
  const { toggleDone, toggleStar, deleteRecord } = useStore();
  return (
    <div className={clsx('card', 'todo-item', record.done && 'done')}>
      <button
        className="check"
        onClick={() => toggleDone(record.id)}
        aria-label={record.done ? '标记为未完成' : '标记为完成'}
      >
        ✓
      </button>
      <div className="record-main">
        <div
          className="record-title"
          onClick={() => requestEditor({ recordId: record.id })}
          role="button"
          tabIndex={0}
        >
          {record.title}
        </div>
        <div className="record-meta">
          {record.priority !== 'none' && (
            <span className={`priority-flag priority-${record.priority}`}>
              {record.priority === 'high' ? '高优先级' : record.priority === 'medium' ? '中优先级' : '低优先级'}
            </span>
          )}
          {record.dueDate && <DueBadge dueDate={record.dueDate} />}
        </div>
      </div>
      <div className="record-actions">
        <button
          className={clsx('star-btn', record.starred && 'on')}
          title={record.starred ? '移出重要' : '标为重要'}
          onClick={() => toggleStar(record.id)}
        >
          <Star size={15} fill={record.starred ? 'currentColor' : 'none'} />
        </button>
        <button
          className="icon-btn danger"
          title="删除"
          onClick={() => window.confirm(`确定删除「${record.title}」吗？`) && deleteRecord(record.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export function TodoView({ typeId }: { typeId: string }) {
  const state = useStore();
  const { types, addRecord, clearDone } = state;
  const [tab, setTab] = useState<Tab>('today');
  const [quick, setQuick] = useState('');

  const all = useMemo(() => selectFiltered(state, typeId), [state, typeId]);
  const type = types.find((t) => t.id === typeId);

  const today = todayStr();
  const groups = useMemo<Record<string, RecordItem[]>>(() => {
    const active = all.filter((r) => !r.done);
    const done = all.filter((r) => r.done);
    const result: Record<string, RecordItem[]> = {};
    if (tab === 'today') {
      result['今天'] = active.filter((r) => r.dueDate && daysFromToday(r.dueDate) <= 0);
      result['未安排日期'] = active.filter((r) => !r.dueDate);
      result['以后'] = active.filter((r) => r.dueDate && daysFromToday(r.dueDate) > 0);
    } else if (tab === 'starred') {
      result['重要'] = active.filter((r) => r.starred);
    } else if (tab === 'all') {
      result['未完成'] = active;
      result['已完成'] = done;
    } else {
      result['已完成'] = done;
    }
    return result;
  }, [all, tab]);

  const counts: Record<Tab, number> = useMemo(() => {
    const active = all.filter((r) => !r.done);
    return {
      today: active.filter((r) => r.dueDate && daysFromToday(r.dueDate) <= 0).length,
      starred: active.filter((r) => r.starred).length,
      all: active.length,
      done: all.filter((r) => r.done).length,
    };
  }, [all]);

  if (!type) return null;

  const submitQuick = () => {
    const title = quick.trim();
    if (!title) return;
    addRecord({
      typeId,
      title,
      dueDate: tab === 'today' ? today : null,
      starred: tab === 'starred',
    });
    setQuick('');
  };

  const isEmpty = Object.values(groups).every((g) => g.length === 0);

  const doneTotal = state.records.filter(
    (r) => r.typeId === typeId && r.done && !r.archived,
  ).length;

  const clearAll = () => {
    if (window.confirm(`确定删除全部 ${doneTotal} 条已完成待办吗？此操作不可恢复。`)) {
      clearDone(typeId);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">
          {type.name} <InlineNotes text={type.note} />
        </h1>
        <p className="page-desc">一件一件来，像节拍器一样稳。</p>
      </div>

      <div className="card todo-quick-add">
        <Plus size={17} className="plus" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
          placeholder={tab === 'today' ? '添加今天要做的事，回车创建' : '添加待办，回车创建'}
        />
        <button className="btn btn-primary btn-sm" onClick={submitQuick}>
          添加
        </button>
      </div>

      <div className="todo-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={clsx('todo-tab', tab === t.key && 'active')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {isEmpty ? (
        <Empty text="这个分组空空如也" />
      ) : (
        Object.entries(groups).map(
          ([label, items]) =>
            items.length > 0 && (
              <div key={label}>
                <div className="todo-group-label">
                  <span>{label}</span>
                  {label === '已完成' && (
                    <button className="clear-done-btn" onClick={clearAll}>
                      清空已完成
                    </button>
                  )}
                </div>
                <div className="record-list">
                  {items.map((r) => (
                    <TodoItem key={r.id} record={r} />
                  ))}
                </div>
              </div>
            ),
        )
      )}
    </div>
  );
}
