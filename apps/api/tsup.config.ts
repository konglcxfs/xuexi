import { defineConfig } from 'tsup'

/**
 * apps/api 打包配置 —— 专为 Electron 桌面端内嵌场景设计。
 *
 * 为什么用 tsup 而不是纯 tsc：
 *   - tsc 输出保留相对 import './foo' 而不带 .js 后缀，Node ESM 跑会报
 *     "Cannot find module './foo'"。
 *   - tsup 用 esbuild 把所有相对路径 + workspace 包打成一个独立 ESM bundle，
 *     不依赖任何 import 解析规则，Electron fork 起来即跑即用。
 *
 * 注意：
 *   - 11 个依赖 (fastify / zod / openai / ... ) 我们仍保持 external，避免
 *     把 native 模块打进 bundle。
 *   - monorepo 包 (@xuexi/*) 必须 noExternal，否则找不到 workspace 引用。
 *   - 产物位于 dist/index.mjs（type: module，.mjs 后缀）。
 */

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outExtension({ format }) {
    return { js: `.${format}.js` }
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  external: [
    'fastify',
    '@fastify/cors',
    'zod',
    'openai',
    'better-sqlite3',
    'node:sqlite',
  ],
  noExternal: [/^@xuexi\//],
  shims: true, // 让 __dirname / import.meta.url 在 ESM 里好用
})
