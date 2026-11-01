
/* Image sequence to PDF, adapted from the user-provided HTML. PDF embedding uses pdf-lib (MIT). */

  'use strict';
  const pause = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('已取消', 'AbortError'));
    const stop = () => { clearTimeout(timer); reject(new DOMException('已取消', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
  function sequence(input) {
    if (!input.trim()) throw new Error('请输入起始图片链接。');
    let url;
    try { url = new URL(input.trim()); }
    catch { throw new Error('请输入完整的 HTTP / HTTPS 图片地址，例如 https://example.com/1.png。'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('请输入不含用户名和密码的 HTTP / HTTPS 图片地址。');
    const match = url.pathname.match(/^(.*\/)(\d+)(\.(?:png|jpe?g))$/i);
    if (!match) throw new Error('地址须以数字编号的 PNG / JPG / JPEG 图片名结尾，例如 /1.png 或 /001.jpg。');
    const start = Number(match[2]);
    if (!Number.isSafeInteger(start) || start >= Number.MAX_SAFE_INTEGER) throw new Error('图片编号过大。');
    const padded = match[2].length > 1 && match[2][0] === '0';
    return { start, at(n) {
      if (!Number.isSafeInteger(n)) throw new Error('图片编号超出安全整数范围。');
      const next = new URL(url.href);
      next.hash = '';
      next.pathname = match[1] + (padded ? String(n).padStart(match[2].length, '0') : n) + match[3];
      return next.href;
    } };
  }
  function filename(now = new Date()) {
    const p = (n, width = 2) => String(n).padStart(width, '0');
    return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}-${p(now.getMilliseconds(),3)}.pdf`;
  }
  async function imageRequest(url, { signal, fetchFn = fetch, timeoutMs = 30000, retryDelay = 1000, onRetry = () => {} } = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      const local = new AbortController();
      const cancel = () => local.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => local.abort(), timeoutMs);
      try {
        const response = await fetchFn(url, { mode: 'cors', credentials: 'omit', signal: local.signal, cache: 'no-store', referrerPolicy: 'no-referrer' });
        if (response.status === 404) { await response.body?.cancel(); return null; }
        if (!response.ok) {
          await response.body?.cancel();
          const error = new Error(`HTTP ${response.status}：读取失败。`);
          error.retryable = response.status === 429 || response.status >= 500;
          throw error;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) { const error = new Error('服务器返回空文件。'); error.retryable = false; throw error; }
        return bytes;
      } catch (error) {
        if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
        if (error.retryable === false) throw error;
        if (attempt === 2) {
          if (error.name === 'AbortError') throw new Error('请求超时，已重试 2 次。');
          if (error instanceof TypeError) throw new Error('网络或跨域读取失败。服务器须在图片及 404 响应中允许 CORS；浏览器不能绕过此限制。');
          throw error;
        }
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
      onRetry(attempt + 1);
      await pause(retryDelay * (attempt + 1), signal);
    }
  }
  function imageType(bytes) {
    const png = [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
    if (png) return 'png';
    if (bytes[0] === 255 && bytes[1] === 216) return 'jpeg';
    throw new Error('响应不是 PNG / JPEG 图片，可能是登录页、拦截页或无效内容。');
  }
  async function appendImage(pdf, bytes) {
    const image = imageType(bytes) === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    // Convert pixels to points at 96 dpi, preserving aspect ratio and source data.
    const factor = Math.min(0.75, 14400 / Math.max(image.width, image.height));
    const width = image.width * factor, height = image.height * factor;
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    await pdf.flush();
  }
  async function collect({ url, images = [], signal, maxPages = 1000, maxBytes = 512 * 1024 * 1024,
    onProgress = () => {}, requestOptions = {} }) {
    const seq = sequence(url);
    let pages = 0, totalBytes = 0;
    for (let n = seq.start; ; n++) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      onProgress({ phase: 'fetch', number: n, pages, totalBytes });
      let bytes = await imageRequest(seq.at(n), { ...requestOptions, signal,
        onRetry: (attempt) => onProgress({ phase: 'retry', number: n, pages, totalBytes, attempt }) });
      if (bytes === null) return { pages, totalBytes, missing: n, images };
      if (pages >= maxPages) throw new Error(`已达到 ${maxPages} 页上限，下一张仍存在。可导出当前部分，或提高上限重新开始。`);
      if (totalBytes + bytes.length > maxBytes) throw new Error('原始图片总量将超过 512 MB 内存保护上限。请分段处理。');
      try { imageType(bytes); }
      catch (error) { throw new Error(`第 ${n} 张图片无效：${error.message}`); }
      images.push({ number: n, bytes });
      totalBytes += bytes.length;
      bytes = null;
      pages++;
      onProgress({ phase: 'downloaded', number: n, pages, totalBytes });
      await pause(0, signal);
    }
  }
  async function merge({ images, pdf, signal, onProgress = () => {} }) {
    for (let i = 0; i < images.length; i++) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      const { number, bytes } = images[i];
      onProgress({ phase: 'embed', number, completed: i, total: images.length });
      try { await appendImage(pdf, bytes); }
      catch (error) { throw new Error(`第 ${number} 张图片无法合并：${error.message}`); }
      onProgress({ phase: 'merged', number, completed: i + 1, total: images.length });
      await pause(0, signal);
    }
    return pdf;
  }
export { sequence, filename, imageRequest, appendImage, collect, merge };


