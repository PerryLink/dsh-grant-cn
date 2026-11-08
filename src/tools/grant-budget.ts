/**
 * `grant_budget` — 预算算术与结构校验。
 * @module dsh-grant-cn/tools/grant-budget
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { GrantError, type GrantRuntime } from '../runtime.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    budget: { type: 'json' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * 构建 `grant_budget`。
 * @param runtime - runtime。
 * @returns 工具定义。
 */
export function makeGrantBudgetTool(runtime: GrantRuntime) {
  return defineTool({
    name: 'grant_budget',
    description: [
      '校验中文基金预算表（dsh-grant-cn）：科目是否在允许列表、金额是否非负、是否重复、直接费用/间接费用/总经费是否与科目之和一致、是否有测算依据说明。',
      '',
      '只做算术与结构校验，不判断预算是否合理，也不内置任何比例上限（间接费用比例按当年指南核定）。默认科目：设备费、业务费、劳务费、间接费用（2021 年以来国家自然科学基金直接费用三类 + 间接费用），可用 categories 覆盖。',
    ].join('\n'),
    parameters: {
      items: { type: 'json', required: true, description: '[{category, amount, note?}]。' },
      totalDirect: { type: 'number', description: '直接费用合计（可选）。' },
      totalIndirect: { type: 'number', description: '间接费用合计（可选）。' },
      total: { type: 'number', description: '总经费（可选）。' },
      categories: { type: 'array', items: { type: 'string' }, description: '允许的科目列表。' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; budget: { valid: boolean; direct: number; indirect: number; total: number; checks: Array<{ status: string }> } } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `grant_budget 失败（${result.error.code}）：${result.error.message}` }]
        const failed = result.budget.checks.filter(check => check.status === 'fail').length
        const warned = result.budget.checks.filter(check => check.status === 'warn').length
        return [
          {
            type: 'text',
            text: `grant_budget：${result.budget.valid ? '通过' : '未通过'}；直接 ${result.budget.direct} + 间接 ${result.budget.indirect} = ${result.budget.total}；${failed} 个失败、${warned} 个提醒`,
          },
        ]
      },
    },
    async execute(args: unknown) {
      try {
        return { ok: true as const, budget: runtime.budget(args as Parameters<GrantRuntime['budget']>[0]) as never }
      } catch (error) {
        if (error instanceof GrantError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
