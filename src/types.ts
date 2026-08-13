export type Status = 'planned' | 'active' | 'paused' | 'done';
export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface CustomField {
  id: string;
  name: string;
  value: string;
}

export interface RecordItem {
  id: string;
  typeId: string;
  workspaceId: string;
  title: string;
  content: string;
  status: Status;
  /** 今日重点 */
  starred: boolean;
  archived: boolean;
  fields: CustomField[];
  /** 待办专用 */
  priority: Priority;
  dueDate: string | null;
  done: boolean;
  /** 日程专用：计划在哪一天（YYYY-MM-DD）与可选起止时间（HH:mm） */
  planDate: string | null;
  planStart: string | null;
  planEnd: string | null;
  /** 科研项目专用：纵向 / 横向细分 */
  sub?: 'vertical' | 'horizontal' | null;
  createdAt: number;
  updatedAt: number;
  /** 手动排序权重（同类型内，越小越靠前；未设置时按更新时间倒序兜底） */
  order?: number;
}

export type TypeKind = 'generic' | 'todo' | 'schedule' | 'direction' | 'project';

export interface TypeDef {
  id: string;
  name: string;
  kind: TypeKind;
  icon: string;
  /** 该类型对应的装饰音符 */
  note: string;
  builtin: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  builtin: boolean;
}

export interface ExportPayload {
  app: 'research-workbench';
  version: 1;
  exportedAt: string;
  records: RecordItem[];
  types: TypeDef[];
  workspaces: Workspace[];
}

/** 可供分配的音符组合（保证各类型互不相同） */
export const NOTE_GLYPHS = [
  '♪',
  '♫',
  '♩',
  '♬',
  '𝄞',
  '𝄢',
  '𝅘𝅥',
  '𝅘𝅥𝅮',
  '𝅘𝅥𝅯',
  '𝅝',
  '𝅘𝅥',
  '𝅘𝅥𝅮',
  '♪♪',
  '♫♪',
  '♩♫',
  '♬♪',
  '♪♬',
  '♫♩',
  '𝄞♪',
  '𝅘𝅥♫',
  '♬♩',
  '𝅘𝅥𝅮♪',
];

export function pickNote(id: string, taken: string[]): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  for (let k = 0; k < NOTE_GLYPHS.length; k++) {
    const g = NOTE_GLYPHS[(h + k) % NOTE_GLYPHS.length];
    if (!taken.includes(g)) return g;
  }
  return NOTE_GLYPHS[h % NOTE_GLYPHS.length];
}

/** 科研项目的纵向 / 横向细分标签 */
export const SUB_LABEL: Record<string, string> = {
  vertical: '纵向',
  horizontal: '横向',
};

export const STATUS_LABEL: Record<Status, string> = {
  planned: '待开始',
  active: '进行中',
  paused: '已搁置',
  done: '已完成',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: '无',
  low: '低',
  medium: '中',
  high: '高',
};
