/**
 * 经费预算校验：只做**算术与结构性**检查，不替申请人判断预算是否合理。
 *
 * 科目默认按 2021 年以来国家自然科学基金直接费用的三类（设备费、业务费、
 * 劳务费）加间接费用；科目可通过参数覆盖。插件**不内置任何比例上限**：
 * 间接费用比例按当年指南核定，插件只校验“填的数与合计一致”。
 *
 * @module dsh-grant-cn/budget
 */

/** 一个预算科目。 */
export interface BudgetItem {
  readonly category: string
  readonly amount: number
  readonly note?: string
}

/** 预算检查请求。 */
export interface BudgetRequest {
  readonly items: readonly BudgetItem[]
  /** 直接费用合计（可选）。 */
  readonly totalDirect?: number
  /** 间接费用合计（可选）。 */
  readonly totalIndirect?: number
  /** 总经费（可选）；缺省时 = 直接 + 间接。 */
  readonly total?: number
  /** 允许的科目（默认：设备费、业务费、劳务费、间接费用）。 */
  readonly categories?: readonly string[]
}

/** 一条预算检查结果。 */
export interface BudgetCheck {
  readonly code: string
  readonly status: 'pass' | 'warn' | 'fail'
  readonly detail: string
}

/** 预算校验结果。 */
export interface BudgetResult {
  readonly items: readonly BudgetItem[]
  readonly direct: number
  readonly indirect: number
  readonly total: number
  readonly checks: readonly BudgetCheck[]
  readonly issues: readonly string[]
  readonly valid: boolean
}

/** 默认科目。 */
export const DEFAULT_BUDGET_CATEGORIES = ['设备费', '业务费', '劳务费', '间接费用'] as const

/** 间接费用科目名。 */
const INDIRECT = '间接费用'

/**
 * 校验预算。
 * @param request - 科目、金额与合计。
 * @returns 合计、检查项与结论。
 */
export function checkBudget(request: BudgetRequest): BudgetResult {
  const categories = Array.isArray(request.categories) ? request.categories : DEFAULT_BUDGET_CATEGORIES
  const checks: BudgetCheck[] = []
  const issues: string[] = []
  const items = (Array.isArray(request.items) ? request.items : []).map(item => ({ ...item }))

  if (items.length === 0) {
    checks.push({ code: 'empty', status: 'fail', detail: '预算没有任何科目' })
    issues.push('预算为空')
  }
  for (const item of items) {
    if (!categories.includes(item.category)) {
      checks.push({ code: 'unknown-category', status: 'warn', detail: `科目“${item.category}”不在允许列表（${categories.join('、')}）` })
    }
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      checks.push({ code: 'invalid-amount', status: 'fail', detail: `科目“${item.category}”金额非法：${String(item.amount)}` })
      issues.push(`金额非法：${item.category}`)
    } else if (item.amount === 0) {
      checks.push({ code: 'zero-amount', status: 'warn', detail: `科目“${item.category}”为 0，确认是否遗漏` })
    }
  }
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.category)) checks.push({ code: 'duplicate-category', status: 'warn', detail: `科目“${item.category}”重复出现，请合并` })
    seen.add(item.category)
  }

  // Invalid (non-finite/negative) amounts are reported above and contribute 0
  // to the totals, so one bad row cannot turn direct/indirect into NaN.
  const amountOf = (item: BudgetItem): number => (typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount >= 0 ? item.amount : 0)
  const direct = Number(items.filter(item => item.category !== INDIRECT).reduce((sum, item) => sum + amountOf(item), 0).toFixed(2))
  const indirect = Number(items.filter(item => item.category === INDIRECT).reduce((sum, item) => sum + amountOf(item), 0).toFixed(2))
  const total = Number((direct + indirect).toFixed(2))

  if (request.totalDirect !== undefined) {
    if (Math.abs(request.totalDirect - direct) > 0.005) {
      checks.push({ code: 'direct-mismatch', status: 'fail', detail: `直接费用合计 ${request.totalDirect} 与科目之和 ${direct} 不一致` })
      issues.push('直接费用合计不一致')
    } else {
      checks.push({ code: 'direct-match', status: 'pass', detail: `直接费用合计一致（${direct}）` })
    }
  }
  if (request.totalIndirect !== undefined) {
    if (Math.abs(request.totalIndirect - indirect) > 0.005) {
      checks.push({ code: 'indirect-mismatch', status: 'fail', detail: `间接费用合计 ${request.totalIndirect} 与科目之和 ${indirect} 不一致` })
      issues.push('间接费用合计不一致')
    } else {
      checks.push({ code: 'indirect-match', status: 'pass', detail: `间接费用合计一致（${indirect}）` })
    }
  }
  if (request.total !== undefined && Math.abs(request.total - total) > 0.005) {
    checks.push({ code: 'total-mismatch', status: 'fail', detail: `总经费 ${request.total} 与直接+间接 ${total} 不一致` })
    issues.push('总经费不一致')
  }
  if (indirect === 0 && categories.includes(INDIRECT)) {
    checks.push({ code: 'no-indirect', status: 'warn', detail: '未填间接费用：若依托单位允许，可填 0，但需确认指南要求' })
  }
  if (!items.some(item => typeof item.note === 'string' && item.note.trim() !== '')) {
    checks.push({ code: 'no-basis', status: 'warn', detail: '没有任何科目给出测算依据，评审会追问' })
  }
  const valid = !checks.some(check => check.status === 'fail')
  return { items, direct, indirect, total, checks, issues, valid }
}
