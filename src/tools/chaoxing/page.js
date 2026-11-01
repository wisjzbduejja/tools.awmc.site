import { icon } from '../../shared/icons.js';
import * as core from './core.js';
import './style.css';

export function mount(main, tool) {
  main.innerHTML = `
    <a class="back-link" href="/">${icon('back')}全部工具</a>
    <h1 class="tool-heading">${tool.name}</h1>
    <div class="workspace-layout">
      <section class="workspace smooth" data-radius="16" aria-label="下载设置">
        <form id="download-form" novalidate>
          <label for="source">起始图片链接</label>
          <div class="source-row">
            <div class="input-wrap smooth">
              <input id="source" type="url" placeholder="https://example.com/course/1.png" required
                spellcheck="false" autocomplete="off" aria-describedby="source-error">
            </div>
            <button id="clear-source" class="button secondary smooth" type="button" disabled>清空</button>
          </div>
          <p id="source-error" class="field-error" hidden></p>
          <div class="page-limit">
            <label for="cap">安全页数上限</label>
            <div class="input-wrap smooth">
              <input id="cap" type="number" min="1" max="10000" step="1" value="1000" required aria-describedby="cap-error">
            </div>
          </div>
          <p id="cap-error" class="field-error" hidden></p>
          <div class="form-actions">
            <button id="start" class="button primary smooth" type="submit">${icon('download')}开始下载</button>
            <button id="cancel" class="button secondary smooth" type="button" hidden>${icon('close')}取消</button>
          </div>
        </form>
      </section>
      <aside class="instructions">
        <h2>如何获取图片链接</h2>
        <ol>
          <li><span>1</span><div><h3>打开课件</h3><p>在网页版学习通中，进入需要下载的课件。</p></div></li>
          <li><span>2</span><div><h3>复制图像链接</h3><p>右键课件的第一页，选择“复制图像链接”。</p></div></li>
        </ol>
      </aside>
    </div>
    <section class="activity smooth" data-radius="16" aria-label="下载进度">
      <div class="activity-header"><h2>处理记录</h2></div>
      <div class="stats">
        <div><span>已获取</span><strong id="pages">0 <small>页</small></strong></div>
        <div><span>图片大小</span><strong id="size">0.0 <small>MB</small></strong></div>
        <div class="current-status">
          <span>当前状态</span><p id="status" role="status" aria-live="polite">等待输入课件图片链接</p>
        </div>
      </div>
      <div id="log-output" class="log-output" tabindex="0" role="region" aria-label="处理日志">
        <ol id="logs"><li class="log-placeholder">开始后，下载与合并进度会显示在这里。</li></ol>
      </div>
      <div id="recovery" class="recovery" hidden>
        <p>已获取的图片仍保留在当前页面，可合并导出。</p>
        <button id="partial" class="button secondary smooth" type="button">导出已完成部分</button>
        <button id="clear" class="text-button" type="button">释放图片</button>
      </div>
    </section>`;
  const $ = id => main.querySelector(`#${id}`);
  let controller = null, images = [], saving = false, downloadUrl = null;
  const note = (message, mode = '') => {
    if ($('logs').querySelector('.log-placeholder')) $('logs').replaceChildren();
    const row = document.createElement('li'); row.dataset.mode = mode;
    const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const text = document.createElement('span'); text.textContent = message; row.append(time, text); $('logs').append(row);
    while ($('logs').children.length > 200) $('logs').firstChild.remove();
    $('log-output').scrollTop = $('log-output').scrollHeight;
  };
  const status = text => { $('status').textContent = text; };
  function fieldError(id, message) {
    $(id).setAttribute('aria-invalid', 'true');
    $(`${id}-error`).textContent = message;
    $(`${id}-error`).hidden = false;
    status(message);
    $(id).focus();
  }
  function clearFieldError(id) {
    const hadError = $(id).hasAttribute('aria-invalid');
    $(id).removeAttribute('aria-invalid');
    $(`${id}-error`).hidden = true;
    $(`${id}-error`).textContent = '';
    if (hadError) status('等待输入课件图片链接');
  }
  function syncClearButton() {
    $('clear-source').disabled = Boolean(controller) || !$('source').value;
  }
  const busy = value => {
    for (const id of ['start', 'source', 'cap', 'partial', 'clear']) $(id).disabled = value;
    $('cancel').hidden = !value; $('cancel').disabled = saving;
    $('download-form').setAttribute('aria-busy', String(value));
    syncClearButton();
  };
  const release = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = null; images = []; $('recovery').hidden = true;
  };
  async function download(incomplete = false) {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); pdf.setCreator('AWMC 工具箱');
    note(`开始合并 ${images.length} 张图片。`);
    await core.merge({ images, pdf, signal: controller.signal, onProgress(info) {
      if (info.phase === 'merged') status(`正在合并 ${info.completed} / ${info.total} 页`);
    } });
    if (controller.signal.aborted) throw new DOMException('已取消', 'AbortError');
    saving = true; busy(true); status('正在生成 PDF');
    const bytes = await pdf.save();
    downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const name = `${incomplete ? 'partial_' : ''}${core.filename()}`;
    const link = document.createElement('a'); link.href = downloadUrl; link.download = name;
    document.body.append(link); link.click(); link.remove();
    note(`已生成 ${pdf.getPageCount()} 页 PDF：${name}`, 'success');
    status('已发起 PDF 下载');
    await new Promise(resolve => setTimeout(resolve, 1000)); release();
  }
  const failure = error => {
    const cancelled = error.name === 'AbortError';
    status(cancelled ? '操作已取消' : error.message);
    note(cancelled ? '已取消，可导出已获取的图片。' : error.message, cancelled ? '' : 'error');
    $('recovery').hidden = !images.length;
  };
  async function run(task) {
    controller = new AbortController(); busy(true);
    try { await task(); } catch (error) { failure(error); }
    finally { controller = null; saving = false; busy(false); }
  }
  $('download-form').addEventListener('submit', event => {
    event.preventDefault(); if (controller) return;
    clearFieldError('source');
    clearFieldError('cap');
    try { core.sequence($('source').value); }
    catch (error) { fieldError('source', error.message); return; }
    const maxPages = Number($('cap').value);
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10000) {
      fieldError('cap', '安全页数上限请输入 1 至 10000 之间的整数。'); return;
    }
    release(); $('logs').replaceChildren(); $('pages').innerHTML = '0 <small>页</small>'; $('size').innerHTML = '0.0 <small>MB</small>';
    run(async () => {
      note('开始顺序获取图片，遇到 404 后合并。');
      const outcome = await core.collect({ url: $('source').value, images, signal: controller.signal, maxPages,
        onProgress(info) {
          if (info.phase === 'fetch') status(`正在获取第 ${info.number} 张图片`);
          if (info.phase === 'downloaded') {
            $('pages').innerHTML = `${info.pages} <small>页</small>`;
            $('size').innerHTML = `${(info.totalBytes / 1048576).toFixed(1)} <small>MB</small>`;
            note(`第 ${info.number} 张图片已获取`, 'success');
          }
          if (info.phase === 'retry') note(`第 ${info.number} 张读取失败，正在进行第 ${info.attempt} / 2 次重试。`);
        } });
      note(`第 ${outcome.missing} 张返回 404，停止获取。`);
      if (outcome.pages) await download();
      else status('起始图片不存在，请检查链接');
    });
  });
  $('source').addEventListener('input', () => { clearFieldError('source'); syncClearButton(); });
  $('cap').addEventListener('input', () => clearFieldError('cap'));
  $('clear-source').addEventListener('click', () => {
    $('source').value = '';
    clearFieldError('source');
    syncClearButton();
    $('source').focus();
  });
  $('cancel').onclick = () => controller?.abort();
  $('partial').onclick = () => { if (!controller && images.length) run(() => download(true)); };
  $('clear').onclick = () => { release(); status('已释放暂存图片'); note('已释放暂存图片。'); };
  window.addEventListener('beforeunload', event => { if (controller) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { controller?.abort(); release(); });
}
