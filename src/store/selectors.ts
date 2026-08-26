import type { RecordItem, TypeDef } from '../types';

interface SelectorState {
  records: RecordItem[];
  workspaceFilter: string;
  statusFilter: string;
  search: string;
}

export interface FilterInput {
  records: RecordItem[];
  typeId?: string;
  workspaceId: string;
  status: string;
  query: string;
}

export function filterRecords({
  records,
  typeId,
  workspaceId,
  status,
  query,
}: FilterInput): RecordItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return records
    .filter((record) => (typeId ? record.typeId === typeId : true))
    .filter((record) => (workspaceId === 'all' ? true : record.workspaceId === workspaceId))
    .filter((record) => {
      if (status === 'archived') return record.archived;
      if (record.archived) return false;
      return status === 'all' ? true : record.status === status;
    })
    .filter((record) => {
      if (!normalizedQuery) return true;
      const searchableText = [
        record.title,
        record.content,
        ...record.fields.map((field) => `${field.name} ${field.value}`),
      ]
        .join('\n')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function selectFiltered(state: SelectorState, typeId?: string): RecordItem[] {
  return filterRecords({
    records: state.records,
    typeId,
    workspaceId: state.workspaceFilter,
    status: state.statusFilter,
    query: state.search,
  });
}

export function countRecordsByType(
  records: RecordItem[],
  types: TypeDef[],
): Record<string, number> {
  const kinds = new Map(types.map((type) => [type.id, type.kind]));
  const counts = Object.fromEntries(types.map((type) => [type.id, 0])) as Record<string, number>;

  for (const record of records) {
    const kind = kinds.get(record.typeId);
    if (!kind || record.archived || (kind === 'todo' && record.done)) continue;
    counts[record.typeId] += 1;
  }

  return counts;
}

export function countForType(records: RecordItem[], type: TypeDef): number {
  return countRecordsByType(records, [type])[type.id];
}

const PRIORITY_ORDER: Record<RecordItem['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function selectProjectNextActions(
  records: RecordItem[],
  projectId: string,
  today = localToday(),
): RecordItem[] {
  return records
    .filter((record) => record.projectId === projectId && record.typeId === 'todo' && !record.done && !record.archived)
    .sort((left, right) => {
      const leftGroup = left.dueDate ? (left.dueDate < today ? 0 : 1) : 2;
      const rightGroup = right.dueDate ? (right.dueDate < today ? 0 : 1) : 2;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      if (left.dueDate !== right.dueDate) return (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999');
      return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    });
}

function shiftIsoDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function selectProjectWorkbench(
  records: RecordItem[],
  projectId: string,
  today = localToday(),
) {
  const linked = records.filter((record) => record.projectId === projectId && !record.archived);
  const todos = linked.filter((record) => record.typeId === 'todo');
  const openTodos = todos.filter((record) => !record.done);
  const dueIn = (record: RecordItem) => (record.dueDate ? Math.round((new Date(record.dueDate).getTime() - new Date(today).getTime()) / 86400000) : null);
  const recentEnd = shiftIsoDate(today, 14);
  const schedules = linked
    .filter((record) => record.typeId === 'schedule' && record.planDate && record.planDate >= today && record.planDate <= recentEnd)
    .sort((a, b) => `${a.planDate ?? ''} ${a.planStart ?? ''}`.localeCompare(`${b.planDate ?? ''} ${b.planStart ?? ''}`));
  const notes = linked
    .filter((record) => record.typeId !== 'todo' && record.typeId !== 'schedule')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    overdue: openTodos.filter((record) => dueIn(record) !== null && dueIn(record)! < 0),
    today: openTodos.filter((record) => dueIn(record) === 0),
    thisWeek: openTodos.filter((record) => dueIn(record) !== null && dueIn(record)! > 0 && dueIn(record)! <= 7),
    later: openTodos.filter((record) => dueIn(record) !== null && dueIn(record)! > 7),
    undated: openTodos.filter((record) => dueIn(record) === null),
    schedules,
    recentNotes: notes.slice(0, 3),
    moreNotes: Math.max(0, notes.length - 3),
  };
}
