import removeMarkdown from 'remove-markdown';

export function markdownToPlainText(source: string): string {
  const withoutHtml = source.replace(/<[^>]*>/g, ' ');
  return removeMarkdown(withoutHtml, { useImgAltText: true })
    .replace(/\s+/g, ' ')
    .trim();
}

export function markdownSummary(source: string, maxLength = 160): string {
  const plainText = markdownToPlainText(source);
  const characters = Array.from(plainText);
  if (characters.length <= maxLength) return plainText;
  if (maxLength <= 1) return '…'.slice(0, maxLength);
  return `${characters.slice(0, maxLength - 1).join('')}…`;
}
