import './style.css';
import { tools } from './tools/registry.js';
import { icon } from './shared/icons.js';
import { observeSmoothCorners } from './shared/smooth.js';
import { searchField, mountHome } from './pages/home.js';

const current = tools.find(tool => location.pathname === tool.href || location.pathname === `${tool.href}index.html`);
document.querySelector('#app').innerHTML = `
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="/" aria-label="AWMC 工具箱首页">${icon('grid')}<span>AWMC <span class="brand-divider">/</span> 工具箱</span></a>
    ${!current ? searchField() : ''}
  </div></header>
  <main id="main" ${current ? 'class="tool-main"' : ''}></main>`;

const main = document.querySelector('main');
if (current) {
  const page = await current.load(); page.mount(main, current);
} else {
  mountHome(main, tools);
}
observeSmoothCorners();
