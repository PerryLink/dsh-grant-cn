/**
 * 申请材料包扫描：申请书、预算表、伦理批件、承诺书、简历、附件。
 *
 * 只按文件名判断“有没有”，不打开文件、不改名、不转换。
 *
 * @module dsh-grant-cn/pack
 */

import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

/** 材料类型。 */
export type MaterialKind = 'application' | 'budget' | 'ethics' | 'commitment' | 'cv' | 'attachment' | 'recommendation' | 'other'

/** 一个材料条目。 */
export interface MaterialEntry {
  readonly path: string
  readonly kind: MaterialKind
  readonly bytes: number
}

/** 一条材料问题。 */
export interface MaterialIssue {
  readonly code: string
  readonly severity: 'info' | 'warning' | 'error'
  readonly detail: string
  readonly suggestion: string
}

/** 材料包报告。 */
export interface MaterialReport {
  readonly rootId: string
  readonly entries: readonly MaterialEntry[]
  readonly issues: readonly MaterialIssue[]
  readonly ready: boolean
}

/** 按文件名归类。 */
function kindOf(relative: string): MaterialKind {
  const base = path.basename(relative).toLowerCase()
  if (/伦理|irb|ethic/u.test(base)) return 'ethics'
  if (/预算|budget/u.test(base)) return 'budget'
  if (/承诺|声明|declaration/u.test(base)) return 'commitment'
  if (/简历|个人简介|curriculum|\bcv\b/u.test(base)) return 'cv'
  if (/推荐信|recommendation/u.test(base)) return 'recommendation'
  if (/附件|附录|代表性成果|成果清单|appendix|supplement/u.test(base)) return 'attachment'
  if (/申请书|申请正文|proposal|application|正文/u.test(base)) return 'application'
  return 'other'
}

/**
 * 扫描材料目录（默认只扫一层）。
 * @param root - 绝对路径。
 * @returns 材料报告。
 */
export async function scanMaterials(root: string, options: { maxEntries?: number } = {}): Promise<MaterialReport> {
  const maxEntries = options.maxEntries ?? 2000
  const entries: MaterialEntry[] = []
  let truncated = false
  let listing: Dirent[] = []
  try {
    listing = await readdir(root, { withFileTypes: true })
  } catch {
    listing = []
  }
  for (const entry of listing.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entries.length >= maxEntries) { truncated = true; break }
    if (entry.name.startsWith('.') || entry.isDirectory()) continue
    if (!entry.isFile()) continue
    const absolute = path.join(root, entry.name)
    const info = await stat(absolute)
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    entries.push({ path: relative, kind: kindOf(relative), bytes: info.size })
  }
  const issues: MaterialIssue[] = []
  const has = (kind: MaterialKind): boolean => entries.some(entry => entry.kind === kind)
  if (!has('application')) {
    issues.push({ code: 'no_application', severity: 'error', detail: '未找到申请书正文文件', suggestion: '把申请书正文放在材料包根目录（文件名含“申请书”或“正文”）' })
  }
  if (!has('budget')) {
    issues.push({ code: 'no_budget', severity: 'warning', detail: '未找到预算表', suggestion: '补预算表，并与 grant_budget 的校验结果核对' })
  }
  if (!has('ethics')) {
    issues.push({ code: 'no_ethics', severity: 'warning', detail: '未找到伦理批件（涉及人/动物研究时必需）', suggestion: '有伦理批件则放入材料包；不涉及的请在正文说明' })
  }
  if (!has('commitment')) {
    issues.push({ code: 'no_commitment', severity: 'warning', detail: '未找到承诺书/声明', suggestion: '按依托单位要求补签字盖章的承诺书' })
  }
  if (!has('cv')) {
    issues.push({ code: 'no_cv', severity: 'info', detail: '未找到申请人简历', suggestion: '部分项目类型需要简历，按指南确认' })
  }
  if (truncated) {
    issues.push({ code: 'materials_truncated', severity: 'info', detail: `材料扫描在 ${maxEntries} 个文件后停止`, suggestion: '提高 maxEntries 或缩小扫描目录；报告未覆盖全部文件' })
  }
  if (!has('attachment')) {
    issues.push({ code: 'no_attachments', severity: 'info', detail: '未找到代表性成果/附件', suggestion: '按指南要求附代表性成果清单' })
  }
  return { rootId: path.basename(root), entries, issues, ready: !issues.some(issue => issue.severity === 'error') }
}
