import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { sequence, collect, merge, imageRequest } from '../src/tools/chaoxing/core.js';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64'));
test('编号补零、查询参数保留、片段移除及链接校验', () => {
  const seq = sequence('https://example.com/course/009.PNG?token=abc#page');
  assert.equal(seq.start, 9);
  assert.equal(seq.at(10), 'https://example.com/course/010.PNG?token=abc');
  for (const url of ['https://user:pass@example.com/1.png', 'https://example.com/a.png', 'file:///1.png']) assert.throws(() => sequence(url));
  assert.throws(() => sequence('  '), /请输入起始图片链接/);
  assert.throws(() => sequence('不是链接'), /请输入完整的 HTTP \/ HTTPS/);
  assert.throws(() => sequence('https://example.com/1.gif'), /PNG \/ JPG \/ JPEG/);
});
test('连续获取两页，404 正常结束，合并后页序及尺寸正确', async () => {
  const images = [], requested = [];
  const outcome = await collect({ url: 'https://example.com/1.png', images, requestOptions: { fetchFn: async url => {
    requested.push(url);
    return new Response(url.endsWith('/3.png') ? null : png, { status: url.endsWith('/3.png') ? 404 : 200 });
  } } });
  assert.equal(outcome.pages, 2); assert.equal(outcome.missing, 3); assert.equal(requested.length, 3);
  const pdf = await PDFDocument.create(); await merge({ images, pdf });
  const saved = await PDFDocument.load(await pdf.save());
  assert.equal(saved.getPageCount(), 2); assert.deepEqual(saved.getPage(0).getSize(), { width: 0.75, height: 0.75 });
});
test('超过页数上限时保留已获取部分', async () => {
  const images = [];
  await assert.rejects(collect({ url: 'https://example.com/1.png', images, maxPages: 1, requestOptions: { fetchFn: async () => new Response(png) } }), /上限/);
  assert.equal(images.length, 1);
});
test('拒绝登录 HTML，取消操作终止请求', async () => {
  await assert.rejects(collect({ url: 'https://example.com/1.png', requestOptions: { fetchFn: async () => new Response('<html>login</html>') } }), /不是 PNG/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(imageRequest('https://example.com/1.png', { signal: controller.signal }), { name: 'AbortError' });
});
test('服务错误重试两次；403 不重试', async () => {
  let attempts = 0;
  await imageRequest('https://example.com/1.png', { retryDelay: 0, fetchFn: async () => {
    attempts++; return attempts < 3 ? new Response(null, { status: 503 }) : new Response(png);
  } });
  assert.equal(attempts, 3); attempts = 0;
  await assert.rejects(imageRequest('https://example.com/1.png', { fetchFn: async () => { attempts++; return new Response(null, { status: 403 }); } }), /403/);
  assert.equal(attempts, 1);
});
