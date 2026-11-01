# AWMC 工具箱

纯前端工具站：工具目录首页、超星学习通课件下载。使用 Vite + 原生 JavaScript，构建产物为静态 HTML / CSS / JS，无服务器、数据库或运行时密钥。

## 本地开发

需要 Node.js 22.12+（建议 24 LTS）。

```sh
npm ci
npm run dev
```

首页：http://127.0.0.1:5173/  
课件工具：http://127.0.0.1:5173/tools/chaoxing/

```sh
npm test
npm run build
npm run preview
```

## GitHub → 腾讯 EdgeOne Pages

1. 将此目录提交至自己的 GitHub 仓库，包含 `package-lock.json`，不要提交 `node_modules` 或 `dist`。
2. 在 EdgeOne Pages 导入该仓库，选择部署分支。
3. 框架选择 Vite（或其他静态框架），根目录为仓库根目录；已在 `edgeone.json` 声明安装命令 `npm ci`、构建命令 `npm run build`、输出目录 `dist` 和 Node.js 22.12.0。
4. 选择 Node.js 22.12+ 或 24；不需要配置环境变量。
5. 部署后检查 `/` 和 `/tools/chaoxing/`，包括直接访问与刷新。

配置字段参考 [EdgeOne 官方说明](https://pages.edgeone.ai/document/edgeone-json)。Node.js 版本也通过 `.nvmrc` 固定；若构建环境限制可选版本，请使用满足 Vite 要求的 22.12+ / 24。

这是多页面构建，工具页面有独立的 `index.html`。不需要 SPA 回退，也不要将所有路径重写到首页。项目默认部署在域名根路径；子目录托管需要同时调整 Vite base 和导航 URL。

## 项目结构与添加工具

```text
index.html                     首页 HTML
tools/chaoxing/index.html       工具 HTML，支持独立访问
src/main.js                    公共页头与页面加载
src/style.css                  设计变量与共享样式
src/pages/home.js              首页卡片、页头搜索与筛选
src/pages/home.css             首页专属布局
src/shared/icons.js            统一线性图标
src/shared/smooth.js           共享连续圆角，cornerSmoothing = 0.6
src/tools/registry.js           工具元数据与懒加载入口
src/tools/chaoxing/page.js      课件工具界面与交互
src/tools/chaoxing/style.css    课件工具专属布局
src/tools/chaoxing/core.js      图片序列、网络请求、PDF 合并
tests/chaoxing.test.js          下载与合并流程测试
```

新增工具：

1. 新建 `src/tools/<id>/page.js`，导出 `mount(main, tool)`；实现逻辑放在同目录的独立模块。
2. 在 `src/tools/registry.js` 增加 `id`、名称、说明、URL 与动态 `load`，可通过 `keywords` 数组补充搜索关键词。首页搜索与入口自动生成；卡片仅显示名称与说明。
3. 新建 `tools/<id>/index.html`，引用 `/src/main.js`，设置标题和描述。
4. 在 `vite.config.js` 的 `build.rollupOptions.input` 中注册 HTML。

各工具无需进入首页主包；PDF 库仅在开始合并时加载。共享页头仅保留品牌入口，首页额外显示搜索框；返回工具列表由工具页的返回链接负责。复用 `.button`、`.input-wrap`、`.smooth` 和集中颜色变量，页面专属样式放在各自目录，避免重复建立视觉规范或叠加覆盖补丁。动态新增 `.smooth` 元素后调用 `observeSmoothCorners(container)`；函数返回的观察器可通过 `disconnect()` 释放。

连续圆角由 figma-squircle 根据实际元素尺寸生成，ResizeObserver 处理尺寸变化，SVG 描边与裁切使用同一条路径。尚未执行 JavaScript 或不支持 CSS path 裁切的浏览器降级为统一普通圆角。

## 下载行为与限制

- 参考原始 HTML 的下载算法：从输入编号开始，支持补零和查询参数，依次请求 PNG / JPEG；404 结束后统一合并。
- 每次请求超时 30 秒；网络错误、429、5xx 最多重试两次。检查图片文件头，防止登录页被误当图片。
- 默认页数上限 1000，可设置 1–10000；原始图片总量限制为 512 MB（合并过程还需额外内存，较大课件建议分段）。
- 达到上限、取消或失败后，可导出已完成部分；生成成功后释放图片与下载 URL。刷新或离开页面会丢失暂存图片。
- 图片保持宽高比与原始图像数据，每张对应一页。编号中间的 404 会结束整个序列，须核对生成页数。
- 图片及末尾 404 响应必须允许 CORS。不会携带登录凭据；浏览器无法绕过跨域限制、防盗链或登录鉴权。HTTPS 页面也无法读取被浏览器阻止的 HTTP 图片。
- 图片链接直接请求源站，图片和 PDF 不上传到本站服务器。仅处理你有权访问和保存的课件。

尚未使用真实学习通图片地址进行线上连通性验证，是否可下载取决于源站响应和链接有效期。

## 依赖许可

`pdf-lib`（MIT）、`figma-squircle`（MIT）、Vite（MIT），由 npm 安装，构建时打包，不依赖外部 CDN。下载核心改编自用户提供的 `image-sequence-to-pdf.html`，保留其序列识别、重试和内存保护机制。
