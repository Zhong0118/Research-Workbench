import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, selectFiltered, countForType } from '../store';
import { ensureScheduleType, mergeProjectTypes } from '../sample';
import type { TypeDef } from '../types';
import { orderKey } from '../planUtils';

const initial = useStore.getState();

describe('research workbench store', () => {
  beforeEach(() => {
    useStore.setState(initial, true);
    useStore.getState().resetSample();
  });

  it('载入内置类型与示例数据', () => {
    const s = useStore.getState();
    expect(s.types.length).toBeGreaterThanOrEqual(8);
    expect(s.records.length).toBeGreaterThan(0);
    expect(s.types.find((t) => t.id === 'todo')?.kind).toBe('todo');
    expect(s.types.find((t) => t.id === 'schedule')?.kind).toBe('schedule');
    expect(s.types.find((t) => t.id === 'project')?.kind).toBe('project');
    // 示例日程里有今天的安排，保证总览日程区有内容
    expect(s.records.some((r) => r.typeId === 'schedule' && r.planDate)).toBe(true);
    // 示例科研项目带纵向 / 横向细分
    expect(
      s.records.filter((r) => r.typeId === 'project').every((r) => r.sub === 'vertical' || r.sub === 'horizontal'),
    ).toBe(true);
  });

  it('日程记录：默认无计划日期，ensureScheduleType 幂等', () => {
    const s = useStore.getState();
    const rec = s.addRecord({ typeId: 'schedule', title: '临时安排' });
    const r = useStore.getState().records.find((x) => x.id === rec.id)!;
    expect(r.planDate).toBeNull();
    expect(r.planStart).toBeNull();

    const withoutSchedule = useStore.getState().types.filter((t) => t.id !== 'schedule');
    const once = ensureScheduleType(withoutSchedule);
    expect(once.some((t) => t.id === 'schedule')).toBe(true);
    expect(once.length).toBe(withoutSchedule.length + 1);
    const twice = ensureScheduleType(once);
    expect(twice.length).toBe(once.length);
    // 不动已有类型
    expect(ensureScheduleType(useStore.getState().types)).toBe(useStore.getState().types);
  });

  it('新增 / 编辑 / 复制 / 归档 / 删除记录', () => {
    const s = useStore.getState();
    const rec = s.addRecord({ typeId: 'note', title: '测试笔记' });
    expect(useStore.getState().records.some((r) => r.id === rec.id)).toBe(true);

    s.updateRecord(rec.id, { title: '改名后的笔记' });
    expect(useStore.getState().records.find((r) => r.id === rec.id)?.title).toBe('改名后的笔记');

    s.duplicateRecord(rec.id);
    expect(useStore.getState().records.some((r) => r.title === '改名后的笔记（副本）')).toBe(true);

    s.archiveRecord(rec.id, true);
    expect(useStore.getState().records.find((r) => r.id === rec.id)?.archived).toBe(true);

    const before = useStore.getState().records.length;
    s.deleteRecord(rec.id);
    expect(useStore.getState().records.length).toBe(before - 1);
  });

  it('切换今日重点与待办完成状态', () => {
    const s = useStore.getState();
    const rec = s.addRecord({ typeId: 'todo', title: '写周报' });
    s.toggleStar(rec.id);
    s.toggleDone(rec.id);
    const r = useStore.getState().records.find((x) => x.id === rec.id)!;
    expect(r.starred).toBe(true);
    expect(r.done).toBe(true);
  });

  it('清空已完成待办：未完成的保留，已归档的不受影响', () => {
    const s = useStore.getState();
    const active = s.addRecord({ typeId: 'todo', title: '未完成待办' });
    const done = s.addRecord({ typeId: 'todo', title: '已完成待办' });
    const archivedDone = s.addRecord({ typeId: 'todo', title: '已归档的已完成' });
    s.toggleDone(done.id);
    s.toggleDone(archivedDone.id);
    s.archiveRecord(archivedDone.id, true);

    const doneVisible = useStore
      .getState()
      .records.filter((r) => r.typeId === 'todo' && r.done && !r.archived).length;
    expect(doneVisible).toBeGreaterThanOrEqual(2); // 含示例数据中的已完成待办

    useStore.getState().clearDone('todo');
    const records = useStore.getState().records;
    expect(records.some((r) => r.id === done.id)).toBe(false);
    expect(records.some((r) => r.typeId === 'todo' && r.done && !r.archived)).toBe(false);
    expect(records.some((r) => r.id === active.id)).toBe(true);
    expect(records.some((r) => r.id === archivedDone.id)).toBe(true);
  });

  it('待办类型的展示计数只算未完成', () => {
    const s = useStore.getState();
    const todoType = useStore.getState().types.find((t) => t.id === 'todo')!;
    const before = countForType(useStore.getState().records, todoType);
    const rec = s.addRecord({ typeId: 'todo', title: '计数测试' });
    expect(countForType(useStore.getState().records, todoType)).toBe(before + 1);
    s.toggleDone(rec.id);
    expect(countForType(useStore.getState().records, todoType)).toBe(before);
    s.archiveRecord(rec.id, true);
    expect(countForType(useStore.getState().records, todoType)).toBe(before);
  });

  it('自定义类型增删改，删除类型时清理其记录', () => {
    const s = useStore.getState();
    s.addType('专利');
    const t = useStore.getState().types.find((x) => x.name === '专利')!;
    s.addRecord({ typeId: t.id, title: '发明专利草稿' });
    s.renameType(t.id, '发明专利');
    expect(useStore.getState().types.find((x) => x.id === t.id)?.name).toBe('发明专利');
    s.deleteType(t.id);
    expect(useStore.getState().types.some((x) => x.id === t.id)).toBe(false);
    expect(useStore.getState().records.some((r) => r.typeId === t.id)).toBe(false);
  });

  it('内置类型也可删除，并清理其记录', () => {
    const s = useStore.getState();
    const before = useStore.getState().records.length;
    const noteCount = useStore.getState().records.filter((r) => r.typeId === 'note').length;
    s.deleteType('note');
    expect(useStore.getState().types.some((t) => t.id === 'note')).toBe(false);
    expect(useStore.getState().records.length).toBe(before - noteCount);
  });

  it('每种类型拥有互不相同且非空的音符', () => {
    const s = useStore.getState();
    s.addType('新类型甲');
    s.addType('新类型乙');
    const notes = useStore.getState().types.map((t) => t.note);
    expect(new Set(notes).size).toBe(notes.length);
    notes.forEach((n) => expect(n.length).toBeGreaterThan(0));
  });

  it('拖拽排序：类型可前移、后移、移到末尾', () => {
    const s = useStore.getState();
    const ids = () => useStore.getState().types.map((t) => t.id);
    const before = ids();
    // 「科研方向」移到「科研项目」之前 → 成为第一个
    s.reorderType('direction', 'project', false);
    expect(ids()[0]).toBe('direction');
    expect(ids()[1]).toBe('project');
    // 「科研项目」移到「待办事项」之后
    s.reorderType('project', 'todo', true);
    expect(ids().indexOf('project')).toBe(ids().indexOf('todo') + 1);
    // 自身对自身、未知 id 不改变顺序
    s.reorderType('note', 'note', true);
    s.reorderType('note', 'no-such-id', false);
    expect(ids().length).toBe(before.length);
  });

  it('纵向 / 横向项目合并为科研项目（保留细分、幂等）', () => {
    // 构造 v5 及以前的老数据结构：两个独立项目类型
    const oldTypes: TypeDef[] = [
      { id: 'horizontal', name: '横向项目', kind: 'generic', icon: 'building', note: '♪', builtin: true },
      { id: 'vertical', name: '纵向项目', kind: 'generic', icon: 'landmark', note: '♫', builtin: true },
      ...useStore.getState().types.filter((t) => t.id !== 'project'),
    ];
    const oldRecords = useStore
      .getState()
      .records.map((r) =>
        r.typeId === 'project'
          ? { ...r, typeId: r.sub === 'horizontal' ? 'horizontal' : 'vertical', sub: undefined }
          : r,
      );
    const merged = mergeProjectTypes(oldTypes, oldRecords);
    // 两个老类型消失，project 出现在原最靠前的位置（这里是最前）
    expect(merged.types.some((t) => t.id === 'vertical' || t.id === 'horizontal')).toBe(false);
    expect(merged.types.filter((t) => t.id === 'project').length).toBe(1);
    expect(merged.types[0].id).toBe('project');
    // 记录全部改挂 project 并带细分
    expect(merged.records.every((r) => r.typeId !== 'vertical' && r.typeId !== 'horizontal')).toBe(true);
    expect(
      merged.records
        .filter((r) => r.typeId === 'project')
        .every((r) => r.sub === 'vertical' || r.sub === 'horizontal'),
    ).toBe(true);
    // 音符仍然互不相同
    const notes = merged.types.map((t) => t.note);
    expect(new Set(notes).size).toBe(notes.length);
    // 幂等：再跑一次不再变化
    const again = mergeProjectTypes(merged.types, merged.records);
    expect(again.types).toBe(merged.types);
    expect(again.records).toBe(merged.records);
  });

  it('记录手动排序：前移、后移、幂等，order 规范化', () => {
    const s = useStore.getState();
    const a = s.addRecord({ typeId: 'note', title: '排序甲' });
    const b = s.addRecord({ typeId: 'note', title: '排序乙' });
    const c = s.addRecord({ typeId: 'note', title: '排序丙' });

    const sortedIds = () =>
      useStore
        .getState()
        .records.filter((r) => r.typeId === 'note' && !r.archived)
        .sort((x, y) => orderKey(x) - orderKey(y))
        .map((r) => r.id);

    // 甲移到丙之后 → 二者相邻且甲在后
    useStore.getState().reorderRecord(a.id, c.id, true);
    const ids1 = sortedIds();
    expect(ids1.indexOf(a.id)).toBe(ids1.indexOf(c.id) + 1);
    // 该类型全部可见记录的 order 已规范化为 10/20/30…
    const orders = useStore
      .getState()
      .records.filter((r) => r.typeId === 'note' && !r.archived)
      .map((r) => r.order ?? 0);
    expect(Math.min(...orders)).toBe(10);

    // 甲再移到乙之前
    useStore.getState().reorderRecord(a.id, b.id, false);
    const ids2 = sortedIds();
    expect(ids2.indexOf(a.id)).toBe(ids2.indexOf(b.id) - 1);

    // 自身对自身、未知目标：顺序不变
    useStore.getState().reorderRecord(a.id, a.id, true);
    useStore.getState().reorderRecord(a.id, 'no-such-id', false);
    expect(sortedIds()).toEqual(ids2);
  });

  it('搜索与工作区过滤', () => {
    const s = useStore.getState();
    s.addRecord({ typeId: 'note', title: '独特的关键词阿尔法' });
    s.setSearch('阿尔法');
    const filtered = selectFiltered(useStore.getState());
    expect(filtered.length).toBe(1);
    s.setSearch('');
    s.setWorkspaceFilter('ws-default');
    expect(selectFiltered(useStore.getState()).length).toBeGreaterThan(0);
  });

  it('导出后可完整导入；非法数据被拒绝', () => {
    const s = useStore.getState();
    const payload = s.exportData();
    expect(payload.records.length).toBeGreaterThan(0);
    const bad = s.importData({ records: 'nope' });
    expect(bad.ok).toBe(false);
    const incompleteRecord = s.importData({
      ...payload,
      records: [{ id: 'broken', typeId: 'note', title: '字段不完整' }],
    });
    expect(incompleteRecord.ok).toBe(false);
    const missingReference = s.importData({
      ...payload,
      records: [{ ...payload.records[0], typeId: 'missing-type' }],
    });
    expect(missingReference.ok).toBe(false);
    const good = s.importData(JSON.parse(JSON.stringify(payload)));
    expect(good.ok).toBe(true);
    expect(useStore.getState().records.length).toBe(payload.records.length);
  });

  it('导入拒绝会破坏图标渲染的未知图标名', () => {
    const payload = useStore.getState().exportData();
    const result = useStore.getState().importData({
      ...payload,
      types: payload.types.map((type, index) =>
        index === 0 ? { ...type, icon: '__proto__' } : type,
      ),
    });

    expect(result.ok).toBe(false);
  });

  it('导入拒绝不合法的日程日期与时间', () => {
    const payload = useStore.getState().exportData();
    const schedule = payload.records.find((record) => record.typeId === 'schedule')!;
    const replaceSchedule = (patch: Partial<typeof schedule>) => ({
      ...payload,
      records: payload.records.map((record) =>
        record.id === schedule.id ? { ...record, ...patch } : record,
      ),
    });

    expect(useStore.getState().importData(replaceSchedule({ planDate: '__proto__' })).ok).toBe(false);
    expect(useStore.getState().importData(replaceSchedule({ planDate: '2026-02-30' })).ok).toBe(false);
    expect(useStore.getState().importData(replaceSchedule({ planStart: '25:00' })).ok).toBe(false);
  });
});
