import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ExportPayload, RecordItem, TypeDef, Workspace } from './types';
import { pickNote } from './types';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords, ensureScheduleType, mergeProjectTypes } from './sample';
import { orderKey } from './planUtils';
import { isTypeIcon } from './icons';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export type View = 'dashboard' | 'settings' | string;

interface WorkbenchState {
  // 数据
  records: RecordItem[];
  types: TypeDef[];
  workspaces: Workspace[];
  // 界面状态
  view: View;
  workspaceFilter: string; // 'all' 或 workspaceId
  search: string;
  statusFilter: string; // 'all' | status | 'archived'
  /** 总览页问候语中的显示名（留空则只显示问候） */
  displayName: string;
  setDisplayName: (name: string) => void;
  // 记录操作
  addRecord: (partial: Partial<RecordItem> & Pick<RecordItem, 'typeId' | 'title'>) => RecordItem;
  updateRecord: (id: string, patch: Partial<RecordItem>) => void;
  duplicateRecord: (id: string) => void;
  archiveRecord: (id: string, archived: boolean) => void;
  deleteRecord: (id: string) => void;
  /** 清空某类型下全部已完成待办（不动归档记录） */
  clearDone: (typeId: string) => void;
  toggleStar: (id: string) => void;
  toggleDone: (id: string) => void;
  // 类型操作
  addType: (name: string, kind?: TypeDef['kind']) => void;
  renameType: (id: string, name: string) => void;
  deleteType: (id: string) => void;
  /** 拖拽排序：把 id 移动到 targetId 的前/后 */
  reorderType: (id: string, targetId: string, after: boolean) => void;
  /** 同类型内的记录手动排序（会规范化该类型全部可见记录的 order） */
  reorderRecord: (id: string, targetId: string, after: boolean) => void;
  // 工作区操作
  addWorkspace: (name: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  // 界面操作
  setView: (view: View) => void;
  setWorkspaceFilter: (id: string) => void;
  setSearch: (q: string) => void;
  setStatusFilter: (s: string) => void;
  // 数据管理
  exportData: () => ExportPayload;
  importData: (payload: unknown) => { ok: boolean; error?: string };
  resetSample: () => void;
}

const defaultWorkspaceId = (): string => BUILTIN_WORKSPACES[0]?.id ?? 'ws-default';

const STATUS_VALUES = new Set(['planned', 'active', 'paused', 'done']);
const PRIORITY_VALUES = new Set(['none', 'low', 'medium', 'high']);
const TYPE_KIND_VALUES = new Set(['generic', 'todo', 'schedule', 'direction', 'project']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNullableDate(v: unknown): v is string | null {
  if (v === null) return true;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isNullableTime(v: unknown): v is string | null {
  return v === null || (typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v));
}

function isCustomField(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.value === 'string'
  );
}

function isRecord(v: unknown): v is RecordItem {
  if (!isObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.typeId === 'string' &&
    typeof v.workspaceId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.content === 'string' &&
    typeof v.status === 'string' &&
    STATUS_VALUES.has(v.status) &&
    typeof v.starred === 'boolean' &&
    typeof v.archived === 'boolean' &&
    Array.isArray(v.fields) &&
    v.fields.every(isCustomField) &&
    typeof v.priority === 'string' &&
    PRIORITY_VALUES.has(v.priority) &&
    isNullableDate(v.dueDate) &&
    typeof v.done === 'boolean' &&
    isNullableDate(v.planDate) &&
    isNullableTime(v.planStart) &&
    isNullableTime(v.planEnd) &&
    (v.sub === undefined || v.sub === null || v.sub === 'vertical' || v.sub === 'horizontal') &&
    typeof v.createdAt === 'number' &&
    Number.isFinite(v.createdAt) &&
    typeof v.updatedAt === 'number' &&
    Number.isFinite(v.updatedAt) &&
    (v.order === undefined || (typeof v.order === 'number' && Number.isFinite(v.order)))
  );
}

function isTypeDef(v: unknown): v is TypeDef {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.kind === 'string' &&
    TYPE_KIND_VALUES.has(v.kind) &&
    isTypeIcon(v.icon) &&
    (v.note === undefined || typeof v.note === 'string') &&
    typeof v.builtin === 'boolean'
  );
}

function isWorkspace(v: unknown): v is Workspace {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.builtin === 'boolean'
  );
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export const useStore = create<WorkbenchState>()(
  persist(
    (set, get) => ({
      records: buildSampleRecords(),
      types: [...BUILTIN_TYPES],
      workspaces: [...BUILTIN_WORKSPACES],
      view: 'dashboard',
      workspaceFilter: 'all',
      search: '',
      statusFilter: 'all',
      displayName: '',

      addRecord: (partial) => {
        const now = Date.now();
        const record: RecordItem = {
          id: uid(),
          workspaceId: get().workspaceFilter !== 'all' ? get().workspaceFilter : defaultWorkspaceId(),
          content: '',
          status: 'active',
          starred: false,
          archived: false,
          fields: [],
          priority: 'none',
          dueDate: null,
          done: false,
          planDate: null,
          planStart: null,
          planEnd: null,
          createdAt: now,
          updatedAt: now,
          ...partial,
        };
        set((s) => ({ records: [record, ...s.records] }));
        return record;
      },

      updateRecord: (id, patch) =>
        set((s) => ({
          records: s.records.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)),
        })),

      duplicateRecord: (id) => {
        const src = get().records.find((r) => r.id === id);
        if (!src) return;
        const now = Date.now();
        const copy: RecordItem = {
          ...src,
          id: uid(),
          title: `${src.title}（副本）`,
          fields: src.fields.map((f) => ({ ...f, id: uid() })),
          done: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ records: [copy, ...s.records] }));
      },

      archiveRecord: (id, archived) => get().updateRecord(id, { archived }),

      deleteRecord: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),

      clearDone: (typeId) =>
        set((s) => ({
          records: s.records.filter((r) => !(r.typeId === typeId && r.done && !r.archived)),
        })),

      toggleStar: (id) => {
        const r = get().records.find((x) => x.id === id);
        if (r) get().updateRecord(id, { starred: !r.starred });
      },

      toggleDone: (id) => {
        const r = get().records.find((x) => x.id === id);
        if (r) get().updateRecord(id, { done: !r.done });
      },

      addType: (name, kind = 'generic') => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          types: [
            ...s.types,
            {
              id: uid(),
              name: trimmed,
              kind,
              icon: 'tag',
              note: pickNote(trimmed + String(s.types.length), s.types.map((t) => t.note)),
              builtin: false,
            },
          ],
        }));
      },

      renameType: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ types: s.types.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) }));
      },

      deleteType: (id) => {
        const t = get().types.find((x) => x.id === id);
        if (!t) return;
        set((s) => ({
          types: s.types.filter((x) => x.id !== id),
          records: s.records.filter((r) => r.typeId !== id),
          view: s.view === id ? 'dashboard' : s.view,
        }));
      },

      reorderType: (id, targetId, after) =>
        set((s) => {
          if (id === targetId) return {};
          const from = s.types.findIndex((t) => t.id === id);
          if (from < 0 || !s.types.some((t) => t.id === targetId)) return {};
          const types = [...s.types];
          const [moved] = types.splice(from, 1);
          let idx = types.findIndex((t) => t.id === targetId);
          if (after) idx += 1;
          types.splice(idx, 0, moved);
          return { types };
        }),

      reorderRecord: (id, targetId, after) =>
        set((s) => {
          if (id === targetId) return {};
          const src = s.records.find((r) => r.id === id);
          if (!src) return {};
          const siblings = s.records
            .filter((r) => r.typeId === src.typeId && !r.archived)
            .sort((a, b) => orderKey(a) - orderKey(b));
          if (!siblings.some((r) => r.id === targetId)) return {};
          const ids = siblings.map((r) => r.id).filter((x) => x !== id);
          let idx = ids.indexOf(targetId);
          if (after) idx += 1;
          ids.splice(idx, 0, id);
          const orderOf = new Map(ids.map((rid, i) => [rid, (i + 1) * 10]));
          return {
            records: s.records.map((r) =>
              orderOf.has(r.id) ? { ...r, order: orderOf.get(r.id)! } : r,
            ),
          };
        }),

      addWorkspace: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ workspaces: [...s.workspaces, { id: uid(), name: trimmed, builtin: false }] }));
      },

      renameWorkspace: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: trimmed } : w)),
        }));
      },

      deleteWorkspace: (id) => {
        const w = get().workspaces.find((x) => x.id === id);
        if (!w || w.builtin) return;
        const fallback = defaultWorkspaceId();
        set((s) => ({
          workspaces: s.workspaces.filter((x) => x.id !== id),
          records: s.records.map((r) => (r.workspaceId === id ? { ...r, workspaceId: fallback } : r)),
          workspaceFilter: s.workspaceFilter === id ? 'all' : s.workspaceFilter,
        }));
      },

      setView: (view) => set({ view, statusFilter: 'all' }),
      setWorkspaceFilter: (workspaceFilter) => set({ workspaceFilter }),
      setSearch: (search) => set({ search }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setDisplayName: (displayName) => set({ displayName: displayName.trim() }),

      exportData: () => ({
        app: 'research-workbench',
        version: 1,
        exportedAt: new Date().toISOString(),
        records: get().records,
        types: get().types,
        workspaces: get().workspaces,
      }),

      importData: (payload) => {
        if (typeof payload !== 'object' || payload === null) {
          return { ok: false, error: '文件内容不是有效的 JSON 对象' };
        }
        const p = payload as Partial<ExportPayload>;
        if (p.app !== 'research-workbench' || p.version !== 1) {
          return { ok: false, error: '这不是受支持的 Research Workbench 备份' };
        }
        if (!Array.isArray(p.records) || !Array.isArray(p.types) || !Array.isArray(p.workspaces)) {
          return { ok: false, error: '缺少 records / types / workspaces 字段' };
        }
        if (!p.records.every(isRecord)) {
          return { ok: false, error: '记录格式不正确' };
        }
        if (!p.types.every(isTypeDef) || !p.workspaces.every(isWorkspace)) {
          return { ok: false, error: '类型或工作区格式不正确' };
        }
        if (p.types.length === 0 || p.workspaces.length === 0) {
          return { ok: false, error: '类型与工作区不能为空' };
        }
        if (!hasUniqueIds(p.records) || !hasUniqueIds(p.types) || !hasUniqueIds(p.workspaces)) {
          return { ok: false, error: '备份中存在重复 ID' };
        }
        const typeIds = new Set(p.types.map((t) => t.id));
        const workspaceIds = new Set(p.workspaces.map((w) => w.id));
        if (!p.records.every((r) => typeIds.has(r.typeId) && workspaceIds.has(r.workspaceId))) {
          return { ok: false, error: '记录引用了不存在的类型或工作区' };
        }
        set({
          records: p.records,
          types: p.types.map((t) => ({ ...t, note: t.note ?? pickNote(t.id, []) })),
          workspaces: p.workspaces,
          view: 'dashboard',
          workspaceFilter: 'all',
          search: '',
          statusFilter: 'all',
        });
        return { ok: true };
      },

      resetSample: () =>
        set({
          records: buildSampleRecords(),
          types: [...BUILTIN_TYPES],
          workspaces: [...BUILTIN_WORKSPACES],
          view: 'dashboard',
          workspaceFilter: 'all',
          search: '',
          statusFilter: 'all',
        }),
    }),
    {
      name: 'research-workbench-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        records: s.records,
        types: s.types,
        workspaces: s.workspaces,
        displayName: s.displayName,
      }),
      version: 6,
      migrate: (persisted) => {
        const state = persisted as { records: RecordItem[]; types: TypeDef[]; workspaces: Workspace[] };
        // v1/v2 → v3：类型补充 / 刷新装饰音符（内置类型使用最新符号）
        state.types = (state.types ?? []).map((t, i) => {
          const builtin = BUILTIN_TYPES.find((b) => b.id === t.id);
          return { ...t, note: builtin?.note ?? t.note ?? pickNote(t.id + String(i), []) };
        });
        // v3 → v4：为老用户补上「日程安排」类型
        state.types = ensureScheduleType(state.types);
        // v4 → v5：科研方向成为独立类型（kind=direction）；方向记录不再使用今日重点
        state.types = state.types.map((t) =>
          t.id === 'direction' && t.kind !== 'direction' ? { ...t, kind: 'direction' as TypeDef['kind'] } : t,
        );
        const directionIds = new Set(state.types.filter((t) => t.kind === 'direction').map((t) => t.id));
        state.records = (state.records ?? []).map((r) =>
          directionIds.has(r.typeId) && r.starred ? { ...r, starred: false } : r,
        );
        // v5 → v6：纵向 / 横向项目合并为「科研项目」，记录用 sub 保留细分
        const merged = mergeProjectTypes(state.types, state.records);
        state.types = merged.types;
        state.records = merged.records;
        return state;
      },
    },
  ),
);

/** 按当前工作区/搜索/状态过滤后的记录 */
export function selectFiltered(s: WorkbenchState, typeId?: string): RecordItem[] {
  const q = s.search.trim().toLowerCase();
  return s.records
    .filter((r) => (typeId ? r.typeId === typeId : true))
    .filter((r) => (s.workspaceFilter === 'all' ? true : r.workspaceId === s.workspaceFilter))
    .filter((r) => {
      if (s.statusFilter === 'archived') return r.archived;
      if (r.archived) return false;
      return s.statusFilter === 'all' ? true : r.status === s.statusFilter;
    })
    .filter((r) => {
      if (!q) return true;
      const hay = [r.title, r.content, ...r.fields.map((f) => `${f.name} ${f.value}`)]
        .join('\n')
        .toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 类型的展示计数：待办类型只计未完成，其余类型计全部未归档记录 */
export function countForType(records: RecordItem[], t: TypeDef): number {
  return records.filter(
    (r) => r.typeId === t.id && !r.archived && (t.kind !== 'todo' || !r.done),
  ).length;
}

export type { WorkbenchState };
