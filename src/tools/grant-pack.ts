/**
 * `grant_pack` — 申请材料包扫描与导出。
 * @module dsh-grant-cn/tools/grant-pack
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { GrantError, type GrantRuntime } from '../runtime.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    materials: { type: 'json' },
    exports: { type: 'json' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * 构建 `grant_pack`。
 * @param runtime - runtime。
 * @returns 工具定义。
 */
export function makeGrantPackTool(runtime: GrantRuntime) {
  return defineTool({
    name: 'grant_pack',
    description: [
      '扫描基金申请材料包（dsh-grant-cn）：申请书正文、预算表、伦理批件、承诺书/声明、简历、代表性成果附件。',
      '',
      '按文件名判断“有没有”，不打开、不改名、不转换；缺失项给出级别与建议。输出 JSON + Markdown 到 <root>/exports。',
    ].join('\n'),
    parameters: {
      path: { type: 'string', description: '工作区相对的材料目录（默认工作区根）。' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; materials: { ready: boolean; entries: unknown[]; issues: Array<{ severity: string; code: string }> } } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `grant_pack 失败（${result.error.code}）：${result.error.message}` }]
        return [
          {
            type: 'text',
            text: `grant_pack：${result.materials.ready ? '就绪' : '未就绪'}；${result.materials.entries.length} 个文件，${result.materials.issues.length} 个问题`,
          },
        ]
      },
    },
    async execute(args: unknown) {
      try {
        const request = args as { path?: string }
        const result = await runtime.pack(request.path === undefined ? {} : { path: request.path })
        const { exports, ...materials } = result
        return { ok: true as const, materials: materials as never, exports: exports as never }
      } catch (error) {
        if (error instanceof GrantError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
