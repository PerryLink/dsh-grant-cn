/**
 * `grant_check` — 中文本子清单检查。
 * @module dsh-grant-cn/tools/grant-check
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { GrantError, type GrantRuntime } from '../runtime.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    analysis: { type: 'json' },
    evidenceId: { type: 'string' },
    recordPath: { type: 'string' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * 构建 `grant_check`。
 * @param runtime - runtime。
 * @returns 工具定义。
 */
export function makeGrantCheckTool(runtime: GrantRuntime) {
  return defineTool({
    name: 'grant_check',
    description: [
      '检查中文基金申请书（dsh-grant-cn）：项目名称、摘要、科学问题属性（A/B/C/D）、立项依据、研究目标/内容/方案、技术路线、创新点、可行性、研究基础、工作条件、团队、预算与预算说明、伦理、数据共享、限项、参考文献。',
      '',
      '基于中文关键词，命中带字符定位，缺失带建议；输出覆盖率与核心缺失项。这是起步清单（19 项），不是官方评审表，也不是“能否中标”的判断。接收 .md/.txt；docx/pdf 请先转换（PDF 可用 dsh-doc-anchor）。',
    ].join('\n'),
    parameters: {
      text: { type: 'string', description: '本子全文（与 path 二选一）。' },
      path: { type: 'string', description: '工作区相对路径的 .md/.txt 本子。' },
      persist: { type: 'boolean', description: '是否写入 REP 证据与记录（默认 true）。' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; analysis: { present: number; total: number; coverage: number; scheme: string; attributes: string[]; coreMissing: string[] } } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `grant_check 失败（${result.error.code}）：${result.error.message}` }]
        return [
          {
            type: 'text',
            text: `grant_check：覆盖 ${result.analysis.present}/${result.analysis.total}（${(result.analysis.coverage * 100).toFixed(0)}%）；项目类型 ${result.analysis.scheme}；属性 ${result.analysis.attributes.join('、') || '未识别'}；核心缺失 ${result.analysis.coreMissing.length} 项`,
          },
        ]
      },
    },
    async execute(args: unknown) {
      try {
        const result = await runtime.check(args as Parameters<GrantRuntime['check']>[0])
        return {
          ok: true as const,
          analysis: result.analysis as never,
          ...(result.evidenceId === undefined ? {} : { evidenceId: result.evidenceId }),
          ...(result.recordPath === undefined ? {} : { recordPath: result.recordPath }),
        }
      } catch (error) {
        if (error instanceof GrantError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
