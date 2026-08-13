import { useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore, selectFiltered } from '../store';
import type { RecordItem } from '../types';
import { InlineNotes } from './MusicNotes';
import { requestEditor } from '../editorBus';
import { planColor, planTimeText, sortPlans } from '../planUtils';
import { formatDate, todayStr } from '../utils';
import clsx from 'clsx';

const DAY = 86400000;
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const CN_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 「8 月 18 日 · 周二」 */
function agendaDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${m} 月 ${d} 日 · ${CN_WEEK[wd]}`;
}

/** 单个日程块：左色条 + 时间 + 事件（周视图与后续清单共用） */
function PlanChip({ record }: { record: RecordItem }) {
  const color = planColor(record.id);
  return (
    <div
      className="plan-chip"
      style={{ borderLeftColor: color }}
      onClick={() => requestEditor({ recordId: record.id })}
      role="button"
      tabIndex={0}
      title={record.title}
    >
      <span className="t" style={{ color }}>
        {planTimeText(record)}
      </span>
      {record.title}
    </div>
  );
}

export function ScheduleView({ typeId, embedded }: { typeId: string; embedded?: boolean }) {
  const state = useStore();
  const { types } = state;
  const [weekOffset, setWeekOffset] = useState(0);
  const type = types.find((t) => t.id === typeId);
  const all = useMemo(() => selectFiltered(state, typeId), [state, typeId]);

  // 以周一为一周起点
  const days = useMemo(() => {
    const now = new Date();
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monday = today0 - ((now.getDay() + 6) % 7) * DAY;
    const start = monday + weekOffset * 7 * DAY;
    return Array.from({ length: 7 }, (_, i) => {
      const ts = start + i * DAY;
      return { ts, str: formatDate(ts), label: WEEK_LABELS[i] };
    });
  }, [weekOffset]);

  const byDay = useMemo(() => {
    const map = new Map(days.map((day) => [day.str, [] as RecordItem[]]));
    for (const r of all) {
      if (r.planDate) map.get(r.planDate)?.push(r);
    }
    for (const [date, items] of map) map.set(date, sortPlans(items));
    return map;
  }, [all, days]);

  // 本周之后的全部未来安排，按日期分组；只渲染有安排的日期，用多久都不会溢出
  const upcoming = useMemo(() => {
    const weekEnd = days[6].str;
    const future = all
      .filter((r) => r.planDate && r.planDate > weekEnd)
      .sort((a, b) => (a.planDate ?? '').localeCompare(b.planDate ?? ''));
    const groups: Array<{ date: string; items: RecordItem[] }> = [];
    for (const r of future) {
      const last = groups[groups.length - 1];
      if (last && last.date === r.planDate) last.items.push(r);
      else groups.push({ date: r.planDate ?? '', items: [r] });
    }
    for (const g of groups) g.items = sortPlans(g.items);
    return groups;
  }, [all, days]);

  if (!type) return null;

  const today = todayStr();
  const rangeLabel = `${days[0].str.slice(5).replace('-', '/')} – ${days[6].str
    .slice(5)
    .replace('-', '/')}`;

  return (
    <div className="schedule-view">
      {embedded ? (
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {type.name} <InlineNotes text={type.note} />
        </h2>
      ) : (
        <div className="page-head">
          <h1 className="page-title">
            {type.name} <InlineNotes text={type.note} />
          </h1>
          <p className="page-desc">提前落笔，到了那天自有回响。</p>
        </div>
      )}

      <div className="week-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset((n) => n - 1)}>
          <ChevronLeft size={14} />
          上一周
        </button>
        <div className="week-range serif">
          {rangeLabel}
          {weekOffset !== 0 && (
            <button className="week-today-btn" onClick={() => setWeekOffset(0)}>
              回到本周
            </button>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset((n) => n + 1)}>
          下一周
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="schedule-body">
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
                  {items.map((r) => (
                    <PlanChip key={r.id} record={r} />
                  ))}
                </div>
                <button
                  className="day-add"
                  onClick={() => requestEditor({ typeId, planDate: d.str })}
                >
                  <Plus size={13} />
                  安排
                </button>
              </div>
            );
          })}
        </div>

        <aside className="agenda-rail">
          <div className="rail-head serif">
            后续日程 <InlineNotes text="♫" />
          </div>
          <div className="rail-scroll">
            {upcoming.length === 0 ? (
              <div className="rail-empty">
                本周之后暂无安排
                <span>点某天下方的「+ 安排」，把未来的事提前落笔</span>
              </div>
            ) : (
              upcoming.map((g) => (
                <div key={g.date} className="rail-group">
                  <div className="rail-date">{agendaDayLabel(g.date)}</div>
                  {g.items.map((r) => (
                    <PlanChip key={r.id} record={r} />
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
