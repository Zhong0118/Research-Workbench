import { useState } from 'react';
import { MarkdownPreview } from './MarkdownPreview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onOpenExternal: (url: string) => void | Promise<void>;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  onOpenExternal,
  placeholder = '记录细节、心得、实验命令、结果与链接……',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="markdown-editor">
      <div className="markdown-mode" role="group" aria-label="正文显示方式">
        <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
          编辑
        </button>
        <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
          预览
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          className="form-textarea markdown-source"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : value.trim() ? (
        <MarkdownPreview
          source={value}
          onOpenExternal={onOpenExternal}
          className="markdown-preview"
        />
      ) : (
        <div className="markdown-preview markdown-empty">暂无可预览内容</div>
      )}
    </div>
  );
}
