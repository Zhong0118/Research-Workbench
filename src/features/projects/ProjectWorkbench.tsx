import { ArrowRight, Plus } from 'lucide-react';
import type { RecordItem } from '../../domain/models';
import { requestEditor } from '../../editorBus';
import { selectProjectWorkbench } from '../../store/selectors';

function Row({ record, extra }: { record: RecordItem; extra?: string }) {
  return (
    <button type="button" onClick={() => requestEditor({ recordId: record.id })}>
      <ArrowRight size={12} />
      <span>{record.title}</span>
      {extra && <time>{extra}</time>}
    </button>
  );
}

export function ProjectWorkbench({
  records,
  projectId,
  todoTypeId = 'todo',
  scheduleTypeId = 'schedule',
}: {
  records: RecordItem[];
  projectId: string;
  todoTypeId?: string;
  scheduleTypeId?: string;
}) {
  const desk = selectProjectWorkbench(records, projectId);
  const todoGroups = [
    { label: '已过期', items: desk.overdue },
    { label: '今天', items: desk.today },
    { label: '本周', items: desk.thisWeek },
  ].filter((group) => group.items.length > 0);
  const hiddenLater = desk.later.length + desk.undated.length;
  const empty = todoGroups.length === 0 && desk.schedules.length === 0 && desk.recentNotes.length === 0;

  if (empty) {
    return (
      <div className="project-workbench project-workbench-empty">
        <span>这个项目还没有动作</span>
        <span className="project-workbench-add">
          <button type="button" onClick={() => requestEditor({ typeId: todoTypeId, projectId })}><Plus size={12} /> 待办</button>
          <button type="button" onClick={() => requestEditor({ typeId: scheduleTypeId, projectId })}><Plus size={12} /> 日程</button>
        </span>
      </div>
    );
  }

  return (
    <div className="project-workbench">
      <section>
        <div className="project-workbench-label">下一步待办</div>
        {todoGroups.length === 0 ? (
          <div className="project-workbench-empty-line">
            <span>没有近期待办</span>
            <button type="button" onClick={() => requestEditor({ typeId: todoTypeId, projectId })}><Plus size={12} /> 添加</button>
          </div>
        ) : (
          todoGroups.map((group) => (
            <div key={group.label} className="project-workbench-group">
              <span>{group.label}</span>
              {group.items.slice(0, 3).map((record) => <Row key={record.id} record={record} extra={record.dueDate ?? undefined} />)}
            </div>
          ))
        )}
        {hiddenLater > 0 && <div className="project-workbench-more">更远还有 {hiddenLater} 项，去待办「计划 / 档案」看</div>}
      </section>
      <section>
        <div className="project-workbench-label">近两周日程</div>
        {desk.schedules.length === 0 ? (
          <div className="project-workbench-empty-line">
            <span>近两周没有安排</span>
            <button type="button" onClick={() => requestEditor({ typeId: scheduleTypeId, projectId })}><Plus size={12} /> 添加</button>
          </div>
        ) : (
          desk.schedules.slice(0, 4).map((record) => <Row key={record.id} record={record} extra={record.planDate ?? undefined} />)
        )}
      </section>
      {desk.recentNotes.length > 0 && (
        <section>
          <div className="project-workbench-label">最近记录</div>
          {desk.recentNotes.map((record) => <Row key={record.id} record={record} />)}
          {desk.moreNotes > 0 && <div className="project-workbench-more">还有 {desk.moreNotes} 条</div>}
        </section>
      )}
    </div>
  );
}
