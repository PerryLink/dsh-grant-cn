/**
 * `dsh-grant-cn` — 中文基金本子检查：结构/属性/预算/材料包。
 *
 * 三个工具：grant_check、grant_budget、grant_pack。关键词清单，不是评审结论。
 *
 * Function plugin — no default export.
 * @module dsh-grant-cn
 */

import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveConfig, type Config as ConfigShape } from './config.ts'
import { GrantRuntime, type EvidencePort } from './runtime.ts'
import { makeGrantBudgetTool } from './tools/grant-budget.ts'
import { makeGrantCheckTool } from './tools/grant-check.ts'
import { makeGrantPackTool } from './tools/grant-pack.ts'

/** Cordis plugin name. */
export const name = 'grant-cn'

/** The tool registry is required; the REP service is optional. */
export const inject = ['tools']

export { Config, resolveConfig }
export type { ConfigShape }
export type { ResolvedConfig } from './config.ts'
export { VERSION } from './version.ts'
export { CHECKLIST_VERSION, GRANT_ITEMS, SCIENCE_ATTRIBUTES, SCHEMES, itemOf } from './checklist.ts'
export type { GrantItem, Scheme, ScienceAttribute } from './checklist.ts'
export { analyzeGrant, detectAttributes, detectScheme, splitSections } from './analyze.ts'
export type { GrantAnalysis, GrantFinding, GrantSection } from './analyze.ts'
export { DEFAULT_BUDGET_CATEGORIES, checkBudget } from './budget.ts'
export type { BudgetCheck, BudgetItem, BudgetRequest, BudgetResult } from './budget.ts'
export { scanMaterials } from './pack.ts'
export type { MaterialEntry, MaterialIssue, MaterialKind, MaterialReport } from './pack.ts'
export { renderAnalysisMarkdown, renderBudgetMarkdown, renderMaterialsMarkdown, renderSarif } from './report.ts'
export { GrantError, GrantRuntime } from './runtime.ts'
export type { EvidencePort, GrantCheckRequest, GrantCheckResult, GrantErrorCode, GrantRuntimeOptions } from './runtime.ts'
export { makeGrantCheckTool } from './tools/grant-check.ts'
export { makeGrantBudgetTool } from './tools/grant-budget.ts'
export { makeGrantPackTool } from './tools/grant-pack.ts'

/**
 * Mount the three tools.
 * @param ctx - the plugin context (host).
 * @param config - raw plugin config.
 */
export function apply(ctx: Context, config: ConfigShape): void {
  const resolved = resolveConfig(config)
  const logger = ctx.logger('grant-cn')
  if (!resolved.enabled) {
    logger.info('disabled: enabled is false — no tools are mounted')
    return
  }
  const service = ctx.get('researchEvidence') as EvidencePort | undefined
  const runtime = new GrantRuntime({ config: resolved, ...(service === undefined ? {} : { service }) })
  if (service === undefined) {
    logger.info(`ctx.researchEvidence is not mounted; using a local core store under ${resolved.root}`)
  }
  ctx.effect(() => ctx.tools.register(makeGrantCheckTool(runtime)), 'grant-cn: grant_check tool')
  ctx.effect(() => ctx.tools.register(makeGrantBudgetTool(runtime)), 'grant-cn: grant_budget tool')
  ctx.effect(() => ctx.tools.register(makeGrantPackTool(runtime)), 'grant-cn: grant_pack tool')
}
