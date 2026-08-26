import type { CustomField } from '../../domain/models';

export const NOTE_KINDS = ['随手', '实验', '文件', '复盘'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

const HINTS: Record<NoteKind, Array<{ name: string; value: string }>> = {
  随手: [],
  实验: [
    { name: '数据集', value: '' },
    { name: '指标', value: '' },
    { name: '结论', value: '' },
  ],
  文件: [
    { name: '位置', value: '' },
    { name: '包含', value: '' },
  ],
  复盘: [
    { name: '周期', value: '' },
    { name: '下一步', value: '' },
  ],
};

export function noteKindOf(fields: CustomField[]): NoteKind {
  const raw = fields.find((field) => field.name === '笔记类型')?.value.trim();
  return NOTE_KINDS.includes(raw as NoteKind) ? (raw as NoteKind) : '随手';
}

export function withNoteKind(fields: CustomField[], kind: NoteKind, generateId: () => string): CustomField[] {
  const without = fields.filter((field) => field.name !== '笔记类型');
  const existingNames = new Set(without.map((field) => field.name));
  const hints = HINTS[kind]
    .filter((hint) => !existingNames.has(hint.name))
    .map((hint) => ({ id: generateId(), name: hint.name, value: hint.value }));
  return [{ id: generateId(), name: '笔记类型', value: kind }, ...without, ...hints];
}
