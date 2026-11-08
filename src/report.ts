/**
 * Markdown 与 SARIF 渲染。
 * @module dsh-grant-cn/report
 */

import type { GrantAnalysis } from './analyze.ts'
import type { BudgetResult } from './budget.ts'
import type { MaterialReport } from './pack.ts'

/** 渲染本子检查为 Markdown。 */
export function renderAnalysisMarkdown(analysis: GrantAnalysis): string {
  const lines = ['# 基金本子检查', '']
  lines.push(`**字数（去空白）：** ${analysis.wordCount} · **项目类型：** ${analysis.scheme} · **科学问题属性：** ${analysis.attributes.join('、') || '未识别'}`)
  lines.push('')
  lines.push(`**覆盖率：** ${analysis.present}/${analysis.total}（${(analysis.coverage * 100).toFixed(0)}%）`)
  lines.push('')
  const missing = analysis.findings.filter(finding => finding.status === 'missing')
  if (missing.length > 0) {
    lines.push('| 缺失项 | 级别 | 建议 |')
    lines.push('|---|---|---|')
    for (const finding of missing) lines.push(`| ${finding.label} | ${finding.severity} | ${finding.advice ?? ''} |`)
    lines.push('')
  }
  lines.push('## 说明')
  lines.push('')
  for (const note of analysis.notes) lines.push(`- ${note}`)
  lines.push('')
  lines.push('> 关键词清单，不是评审结论。')
  return `${lines.join('\n')}\n`
}

/** 渲染预算校验为 Markdown。 */
export function renderBudgetMarkdown(result: BudgetResult): string {
  const lines = ['# 预算校验', '']
  lines.push(`直接费用合计：**${result.direct}** · 间接费用：**${result.indirect}** · 合计：**${result.total}**`)
  lines.push('')
  lines.push('| 科目 | 金额 | 说明 |')
  lines.push('|---|---:|---|')
  for (const item of result.items) lines.push(`| ${item.category} | ${item.amount} | ${item.note ?? ''} |`)
  lines.push('')
  lines.push(`结论：**${result.valid ? '通过（无 error 级问题）' : '未通过'}**`)
  lines.push('')
  if (result.checks.length > 0) {
    lines.push('| 检查 | 结果 | 说明 |')
    lines.push('|---|---|---|')
    for (const check of result.checks) lines.push(`| ${check.code} | ${check.status} | ${check.detail} |`)
    lines.push('')
  }
  lines.push('> 只校验算术与结构；预算是否合理由评审判断。')
  return `${lines.join('\n')}\n`
}

/** 渲染材料包为 Markdown。 */
export function renderMaterialsMarkdown(report: MaterialReport): string {
  const lines = ['# 申请材料包', '']
  lines.push(`**就绪：** ${report.ready ? '是（无 error 级问题）' : '否'} · **文件：** ${report.entries.length}`)
  lines.push('')
  lines.push('| 文件 | 类型 | 字节 |')
  lines.push('|---|---|---:|')
  for (const entry of report.entries) lines.push(`| ${entry.path} | ${entry.kind} | ${entry.bytes} |`)
  lines.push('')
  if (report.issues.length > 0) {
    lines.push('| 级别 | 问题 | 说明 | 建议 |')
    lines.push('|---|---|---|---|')
    for (const issue of report.issues) lines.push(`| ${issue.severity} | ${issue.code} | ${issue.detail} | ${issue.suggestion} |`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

/** 渲染为 SARIF 2.1.0。 */
export function renderSarif(analysis: GrantAnalysis | undefined, budget: BudgetResult | undefined, materials: MaterialReport | undefined, version: string): Record<string, unknown> {
  const results: Array<Record<string, unknown>> = []
  for (const finding of analysis?.findings.filter(item => item.status === 'missing') ?? []) {
    results.push({
      ruleId: `grant-cn/${finding.id}`,
      level: finding.severity === 'warning' ? 'warning' : 'note',
      message: { text: `缺少${finding.label}：${finding.advice ?? ''}` },
      properties: { item: finding.id },
    })
  }
  for (const issue of budget?.issues ?? []) {
    results.push({ ruleId: 'grant-cn/budget', level: 'error', message: { text: `预算问题：${issue}` } })
  }
  for (const issue of materials?.issues ?? []) {
    results.push({ ruleId: `grant-cn/pack/${issue.code}`, level: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'note', message: { text: `${issue.detail} — ${issue.suggestion}` } })
  }
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'dsh-grant-cn', version } }, results }],
  }
}
