import type { ContentBlock, SelectedContext } from './contracts';

export function blocksToPlainText(blocks: readonly ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(block.level)} ${block.text}`;
        case 'paragraph':
        case 'quote':
          return block.text;
        case 'list':
          return block.items
            .map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`))
            .join('\n');
        case 'table': {
          const header = block.headers.join(' | ');
          const rows = block.rows.map((row) => row.join(' | ')).join('\n');
          return [block.caption, header, rows].filter(Boolean).join('\n');
        }
        case 'code':
          return block.language ? `\`\`\`${block.language}\n${block.text}\n\`\`\`` : block.text;
        case 'image':
          return `![${block.alt}](${block.src})`;
        case 'link':
          return `[${block.text}](${block.href})`;
      }
    })
    .filter((text) => text.trim().length > 0)
    .join('\n\n');
}

export function contextToUntrustedText(context: SelectedContext): string {
  const { target } = context;
  switch (target.kind) {
    case 'text-selection':
      return blocksToPlainText(target.blocks) || target.text;
    case 'element':
      return blocksToPlainText(target.blocks) || target.text;
    case 'page':
      return blocksToPlainText(target.blocks);
    case 'link':
      return `${target.text}\n${target.href}`;
    case 'image':
      return `${target.alt}\n${target.src}`;
  }
}
