import { describe, expect, it } from 'vitest';
import { ensureScheduleType, mergeNoteTypes, mergeProjectTypes } from '../sample';
import { buildInitialSnapshot } from '../repositories';
import type { TypeDef } from '../types';

describe('sample migrations', () => {
  it('adds the schedule type idempotently', () => {
    const types = buildInitialSnapshot().types.filter((type) => type.id !== 'schedule');
    const once = ensureScheduleType(types);
    expect(once.some((type) => type.id === 'schedule')).toBe(true);
    expect(ensureScheduleType(once)).toBe(once);
  });

  it('merges legacy vertical and horizontal project types idempotently', () => {
    const snapshot = buildInitialSnapshot();
    const oldTypes: TypeDef[] = [
      { id: 'horizontal', name: '横向项目', kind: 'generic', icon: 'building', note: '♪', builtin: true },
      { id: 'vertical', name: '纵向项目', kind: 'generic', icon: 'landmark', note: '♫', builtin: true },
      ...snapshot.types.filter((type) => type.id !== 'project'),
    ];
    const oldRecords = snapshot.records.map((record) =>
      record.typeId === 'project'
        ? {
            ...record,
            typeId: record.sub === 'horizontal' ? 'horizontal' : 'vertical',
            sub: undefined,
          }
        : record,
    );

    const merged = mergeProjectTypes(oldTypes, oldRecords);
    expect(merged.types.filter((type) => type.id === 'project')).toHaveLength(1);
    expect(
      merged.records
        .filter((record) => record.typeId === 'project')
        .every((record) => record.sub === 'vertical' || record.sub === 'horizontal'),
    ).toBe(true);
    expect(mergeProjectTypes(merged.types, merged.records)).toEqual(merged);
  });

  it('merges data/file/review types into notes idempotently', () => {
    const snapshot = buildInitialSnapshot();
    const oldTypes: TypeDef[] = [
      ...snapshot.types,
      { id: 'data', name: '数据记录', kind: 'generic', icon: 'database', note: 'x', builtin: true },
      { id: 'file', name: '文件资料', kind: 'generic', icon: 'folder', note: 'y', builtin: true },
      { id: 'review', name: '复盘总结', kind: 'generic', icon: 'history', note: 'z', builtin: true },
    ];
    const oldRecords = [
      ...snapshot.records,
      { ...snapshot.records[0], id: 'n-data', typeId: 'data', title: '实验数据', fields: [] },
      { ...snapshot.records[0], id: 'n-file', typeId: 'file', title: '模板', fields: [] },
      { ...snapshot.records[0], id: 'n-review', typeId: 'review', title: '复盘', fields: [] },
    ];
    const merged = mergeNoteTypes(oldTypes, oldRecords);
    expect(merged.types.some((type) => type.id === 'data' || type.id === 'file' || type.id === 'review')).toBe(false);
    expect(merged.types.find((type) => type.id === 'note')?.name).toBe('笔记');
    expect(merged.records.filter((record) => ['n-data', 'n-file', 'n-review'].includes(record.id)).every((record) => record.typeId === 'note')).toBe(true);
    expect(mergeNoteTypes(merged.types, merged.records)).toEqual(merged);
  });
});
