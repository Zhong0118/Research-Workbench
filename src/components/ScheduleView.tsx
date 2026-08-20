import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import type { RecordItem } from '../types';
import { InlineNotes } from './MusicNotes';
import { requestEditor } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { planColor, planTimeText, sortPlans } from '../planUtils';
import { formatDate, todayStr } from '../utils';
import { markdownSummary } from '../features/markdown/plainText';
import clsx from 'clsx';

const DAY = 86400000;
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const CN_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
type ScheduleMode = 'grid' | 'list';
type ScheduleRange = 'week' | 'future' | 'past' | 'all';

const RANGE_LABELS: Array<{ value: ScheduleRange; label: string }> = [
  { value: 'week', label: '本周' },
  { value: 'future', label: '未来' },
  { value: 'past', label: '历史' },
  { value: 'all', label: '全部' },
];

function localDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(dateStr: string, days: number): string {
  const date = localDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date.getTime());
}

/** 「8 月 18 日 · 周二」 */
function agendaDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${m} 月 ${d} 日 · ${CN_WEEK[wd]}`;
}

/** 单个日程块：左色条 + 时间 + 事件（周视图与后续清单共用） */
function PlanChip({ record }: { record: RecordItem }) {
  const color = planColor(record.id);
  const open = () => requestEditor({ recordId: record.id });
  return (
    <div
      className="plan-chip"
      style={{ borderLeftColor: color }}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      title={record.title}
    >
      <span className="t" style={{ color }}>
        {planTimeText(record)}
      </span>
      <span className="plan-chip-title">{record.title}</span>
    </div>
  );
}

function SchedulePreview({ records, typeId, onOpen }: { records: RecordItem[]; typeId: string; onOpen: () => void }) {
  const today = todayStr();
  const upcoming = records
    .filter((record) => record.planDate && record.planDate >= today)
    .sort((a, b) => `${a.planDate ?? ''} ${a.planStart ?? ''}`.localeCompare(`${b.planDate ?? ''} ${b.planStart ?? ''}`))
    .slice(0, 5);

  return (
    <section className="schedule-preview">
      <div className="schedule-preview-head">
        <div>
          <h2 className="section-title">近期日程 <InlineNotes text="𝅝" /></h2>
          <p>今天与接下来的安排</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onOpen}>
          进入日程管理
          <ArrowRight size={14} />
        </button>
      </div>
      {upcoming.length === 0 ? (
        <button className="schedule-preview-empty" onClick={() => requestEditor({ typeId, planDate: today })}>
          <Plus size={15} /> 今天之后暂无安排，添加第一条日程
        </button>
      ) : (
        <div className="schedule-preview-list">
          {upcoming.map((record) => (
            <button key={record.id} className="schedule-preview-item" onClick={() => requestEditor({ recordId: record.id })}>
              <span className="schedule-preview-date">
                {record.planDate === today ? '今天' : record.planDate?.slice(5).replace('-', '/')}
              </span>
              <span className="schedule-preview-time" style={{ color: planColor(record.id) }}>{planTimeText(record)}</span>
              <span className="schedule-preview-title">{record.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ScheduleView({ typeId, embedded }: { typeId: string; embedded?: boolean }) {
  const { records, types, workspaceFilter, search, statusFilter, setView, deleteRecord } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaceFilter: state.workspaceFilter,
      search: state.search,
      statusFilter: state.statusFilter,
      setView: state.setView,
      deleteRecord: state.deleteRecord,
    })),
  );
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [mode, setMode] = useState<ScheduleMode>('grid');
  const [range, setRange] = useState<ScheduleRange>('future');
  const type = types.find((t) => t.id === typeId);
  const all = useMemo(
    () =>
      filterRecords({
        records,
        typeId,
        workspaceId: workspaceFilter,
        status: statusFilter,
        query: search,
      }),
    [records, search, statusFilter, typeId, workspaceFilter],
  );

  // 以周一为一周起点
  const days = useMemo(() => {
    const anchor = localDate(anchorDate);
    const start = anchor.getTime() - ((anchor.getDay() + 6) % 7) * DAY;
    return Array.from({ length: 7 }, (_, i) => {
      const ts = start + i * DAY;
      return { ts, str: formatDate(ts), label: WEEK_LABELS[i] };
    });
  }, [anchorDate]);

  const byDay = useMemo(() => {
    const map = new Map(days.map((day) => [day.str, [] as RecordItem[]]));
    for (const r of all) {
      if (r.planDate) map.get(r.planDate)?.push(r);
    }
    for (const [date, items] of map) map.set(date, sortPlans(items));
    return map;
  }, [all, days]);

  const managedGroups = useMemo(() => {
    const today = todayStr();
    const weekStart = days[0].str;
    const weekEnd = days[6].str;
    const filtered = all.filter((record) => {
      if (range === 'all') return true;
      if (!record.planDate) return false;
      if (range === 'week') return record.planDate >= weekStart && record.planDate <= weekEnd;
      if (range === 'future') return record.planDate >= today;
      return record.planDate < today;
    });
    filtered.sort((a, b) => {
      const result = `${a.planDate ?? '9999'} ${a.planStart ?? ''}`.localeCompare(`${b.planDate ?? '9999'} ${b.planStart ?? ''}`);
      return range === 'past' ? -result : result;
    });
    const groups: Array<{ date: string; items: RecordItem[] }> = [];
    for (const record of filtered) {
      const date = record.planDate ?? '';
      const last = groups[groups.length - 1];
      if (last?.date === date) last.items.push(record);
      else groups.push({ date, items: [record] });
    }
    return groups;
  }, [all, days, range]);

  if (!type) return null;

  if (embedded) {
    return <SchedulePreview records={all} typeId={typeId} onOpen={() => setView(typeId)} />;
  }

  const today = todayStr();
  const rangeLabel = `${days[0].str.slice(5).replace('-', '/')} – ${days[6].str
    .slice(5)
    .replace('-', '/')}`;

  return (
    <div className="schedule-view">
      <div className="page-head schedule-page-head">
        <div>
          <h1 className="page-title">
            {type.name} <InlineNotes text={type.note} />
          </h1>
          <p className="page-desc">安排一周，也随时回看和整理全部日程。</p>
        </div>
        <button className="btn btn-primary" onClick={() => requestEditor({ typeId, planDate: todayStr() })}>
          <Plus size={15} /> 新建日程
        </button>
      </div>

      <div className="week-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setAnchorDate((date) => shiftDate(date, -7))}>
          <ChevronLeft size={14} />
          上一周
        </button>
        <div className="week-toolbar-center">
          <div className="week-range serif">
            {rangeLabel}
            {!days.some((day) => day.str === today) && (
              <button className="week-today-btn" onClick={() => setAnchorDate(today)}>回到今天</button>
            )}
          </div>
          <div className="schedule-mode-switch" role="group" aria-label="日程显示方式">
            <button
              className={clsx(mode === 'grid' && 'active')}
              aria-pressed={mode === 'grid'}
              onClick={() => setMode('grid')}
            >
              <LayoutGrid size={13} />
              周网格
            </button>
            <button
              className={clsx(mode === 'list' && 'active')}
              aria-pressed={mode === 'list'}
              onClick={() => setMode('list')}
            >
              <List size={13} />
              周清单
            </button>
          </div>
        </div>
        <div className="week-toolbar-end">
          <label className="schedule-date-jump">
            <span>跳转</span>
            <input
              type="date"
              aria-label="跳转到日期"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value || todayStr())}
            />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnchorDate((date) => shiftDate(date, 7))}>
          下一周
          <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="schedule-body">
        {mode === 'grid' ? (
          <div className="week-grid-scroll">
            <div className="week-grid">
              {days.map((d) => {
                const items = byDay.get(d.str) ?? [];
                const isToday = d.str === today;
                return (
                  <div key={d.str} className={clsx('day-col', isToday && 'today')}>
                    <div className="day-head">
                      <span className="day-label">{d.label}</span>
                      <span className={clsx('day-date', isToday && 'on')}>
                        {Number(d.str.slice(8))}
                      </span>
                    </div>
                    <div className="day-items">
                      {items.map((record) => (
                        <PlanChip key={record.id} record={record} />
                      ))}
                    </div>
                    <button
                      className="day-add"
                      aria-label={`在${agendaDayLabel(d.str)}安排日程`}
                      onClick={() => requestEditor({ typeId, planDate: d.str })}
                    >
                      <Plus size={13} />
                      安排
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="week-list">
            {days.map((day) => {
              const items = byDay.get(day.str) ?? [];
              const isToday = day.str === today;
              return (
                <section key={day.str} className={clsx('week-list-day', isToday && 'today')}>
                  <div className="week-list-date">
                    <span>{day.label}</span>
                    <strong>{Number(day.str.slice(5, 7))} 月 {Number(day.str.slice(8))} 日</strong>
                    {isToday && <em>今天</em>}
                  </div>
                  <div className="week-list-items">
                    {items.length > 0 ? (
                      items.map((record) => <PlanChip key={record.id} record={record} />)
                    ) : (
                      <span className="week-list-empty">暂无安排</span>
                    )}
                  </div>
                  <button
                    className="week-list-add"
                    aria-label={`在${agendaDayLabel(day.str)}安排日程`}
                    onClick={() => requestEditor({ typeId, planDate: day.str })}
                  >
                    <Plus size={14} />
                    安排
                  </button>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <section className="schedule-manager">
        <div className="schedule-manager-head">
          <div>
            <h2 className="serif">日程清单</h2>
            <p>按时间范围集中整理，编辑或删除已经落笔的安排。</p>
          </div>
          <div className="schedule-range-switch" role="group" aria-label="日程范围">
            {RANGE_LABELS.map((item) => (
              <button
                key={item.value}
                className={clsx(range === item.value && 'active')}
                aria-pressed={range === item.value}
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="schedule-manager-list">
          {managedGroups.length === 0 ? (
            <div className="schedule-manager-empty">
              此范围内暂无日程
              <span>可以在上方周视图中选择日期，或新建一条安排。</span>
            </div>
          ) : (
            managedGroups.map((group) => (
              <section key={group.date || 'undated'} className="schedule-manager-day">
                <header>
                  <strong>{group.date ? agendaDayLabel(group.date) : '未指定日期'}</strong>
                  <span>{group.items.length} 项</span>
                </header>
                <div className="schedule-manager-items">
                  {group.items.map((record) => {
                    const summary = markdownSummary(record.content, 110);
                    return (
                      <article
                        key={record.id}
                        className="schedule-manager-item"
                        style={{ borderLeftColor: planColor(record.id) }}
                      >
                        <span className="schedule-manager-time" style={{ color: planColor(record.id) }}>
                          {planTimeText(record)}
                        </span>
                        <button
                          className="schedule-manager-content"
                          onClick={() => requestEditor({ recordId: record.id })}
                          title={`编辑 ${record.title}`}
                        >
                          <strong>{record.title}</strong>
                          {summary && <span>{summary}</span>}
                        </button>
                        <div className="schedule-manager-actions">
                          <button
                            className="icon-btn"
                            aria-label={`编辑 ${record.title}`}
                            title="编辑"
                            onClick={() => requestEditor({ recordId: record.id })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn danger"
                            aria-label={`删除 ${record.title}`}
                            title="删除"
                            onClick={() => {
                              void confirmDialog({
                                message: `确定删除日程「${record.title}」吗？`,
                                confirmLabel: '删除',
                                danger: true,
                              }).then((confirmed) => {
                                if (confirmed) void deleteRecord(record.id);
                              });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
