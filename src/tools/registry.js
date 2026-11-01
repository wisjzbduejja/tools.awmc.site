// Add tool metadata here; each tool owns its own page and implementation.
export const tools = [{
  id: 'chaoxing', name: '超星学习通课件下载',
  description: '以图片格式保存章节中无法下载的课件。',
  href: '/tools/chaoxing/', keywords: ['学习工具', '图片', 'PDF'],
  load: () => import('./chaoxing/page.js'),
}];
