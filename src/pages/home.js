import './home.css';
import { icon } from '../shared/icons.js';

export function searchField() {
  return `<div class="search-field smooth" role="search">${icon('search')}
    <input id="search" type="search" placeholder="搜索工具" aria-label="搜索工具" autocomplete="off">
  </div>`;
}

export function mountHome(main, tools) {
  main.innerHTML = `
    <h1 class="catalog-heading">全部工具 <span id="tool-count">${tools.length}</span></h1>
    <div class="tool-grid">${tools.map(tool => `
      <a class="tool-card smooth" data-radius="16" href="${tool.href}" data-tool="${tool.id}">
        <h2>${tool.name}</h2>
        <p>${tool.description}</p>
      </a>`).join('')}
    </div>
    <div id="empty" class="empty" hidden>
      <h2>没有找到匹配的工具</h2>
      <p>试试工具名称，或清空搜索。</p>
      <button id="reset" class="button secondary smooth">清空搜索</button>
    </div>`;

  const search = document.querySelector('#search');
  const cards = new Map(tools.map(tool => [tool.id, main.querySelector(`[data-tool="${tool.id}"]`)]));
  function filterTools() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    tools.forEach(tool => {
      const text = [tool.name, tool.description, ...(tool.keywords ?? [])].join(' ').toLocaleLowerCase();
      const matches = text.includes(query);
      cards.get(tool.id).hidden = !matches;
      count += Number(matches);
    });
    main.querySelector('#tool-count').textContent = count;
    main.querySelector('#empty').hidden = count !== 0;
  }
  search.addEventListener('input', filterTools);
  main.querySelector('#reset').addEventListener('click', () => {
    search.value = '';
    filterTools();
    search.focus();
  });
}
