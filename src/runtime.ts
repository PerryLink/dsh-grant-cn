/**
 * Runtime：路径安全、文本分析、预算校验、材料包扫描与 REP 证据。
 * @module dsh-grant-cn/runtime
 */

import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  EvidenceStore,
  RepStoreError,
  stableId,
  validateRep,
  type AddEvidenceInput,
  type CaptureInput,
  type CheckResult,
  type Evidence,
  type ResearchRecord,
  type Snapshot,
} from '@perrylink/dsh-research-core'
import type { ResolvedConfig } from './config.ts'
import { analyzeGrant, type GrantAnalysis } from './analyze.ts'
import { checkBudget, type BudgetRequest, type BudgetResult } from './budget.ts'
import { scanMaterials, type MaterialReport } from './pack.ts'
import { renderMaterialsMarkdown } from './report.ts'
import { VERSION } from './version.ts'

/** 稳定错误码。 */
export type GrantErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'PATH_ESCAPE' | 'NOT_A_FILE' | 'NOT_A_DIRECTORY' | 'TOO_LARGE' | 'UNSUPPORTED_FILE' | 'STORE_ERROR'

/** 类型化错误。 */
export class GrantError extends Error {
  /** 稳定错误码。 */
  readonly code: GrantErrorCode

  constructor(code: GrantErrorCode, message: string) {
    super(message)
    this.name = 'GrantError'
    this.code = code
  }
}

/** 用到的 REP 服务子集。 */
export interface EvidencePort {
  capture(input: CaptureInput): Promise<{ snapshot: Snapshot }>
  addEvidence(input: AddEvidenceInput): Promise<{ evidence: Evidence }>
  buildRecord(options?: { evidenceIds?: readonly string[] }): Promise<Omit<ResearchRecord, 'manifest'>>
}

/** 检查请求。 */
export interface GrantCheckRequest {
  readonly text?: string
  readonly path?: string
  readonly persist?: boolean
}

/** 检查结果。 */
export interface GrantCheckResult {
  readonly analysis: GrantAnalysis
  readonly evidenceId?: string
  readonly recordPath?: string
}

/** Runtime 选项。 */
export interface GrantRuntimeOptions {
  readonly config: ResolvedConfig
  readonly service?: EvidencePort
  readonly now?: () => Date
}

/** candidate 是否在 root 内。 */
function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
}

/** Runtime。 */
export class GrantRuntime {
  readonly config: ResolvedConfig

  readonly #service: EvidencePort | undefined
  readonly #now: () => Date
  #store: EvidenceStore | undefined

  constructor(options: GrantRuntimeOptions) {
    this.config = options.config
    this.#service = options.service
    this.#now = options.now ?? (() => new Date())
  }

  /** 当前 ISO 时间。 */
  iso(): string {
    return this.#now().toISOString()
  }

  /** 证据端口。 */
  port(): EvidencePort {
    if (this.#service !== undefined) return this.#service
    this.#store ??= new EvidenceStore(path.join(this.config.root, 'store'))
    return this.#store
  }

  /** 解析工作区内的文件。 */
  async resolveFile(input: string): Promise<{ absolute: string; id: string }> {
    if (typeof input !== 'string' || input.trim() === '') throw new GrantError('INVALID_INPUT', 'path 不能为空')
    let realRoot: string
    try {
      realRoot = await realpath(this.config.workspaceRoot)
    } catch {
      throw new GrantError('NOT_FOUND', `工作区不存在：${this.config.workspaceRoot}`)
    }
    const candidate = path.resolve(realRoot, input)
    if (!isInside(realRoot, candidate)) throw new GrantError('PATH_ESCAPE', '路径超出工作区')
    let real: string
    try {
      real = await realpath(candidate)
    } catch {
      throw new GrantError('NOT_FOUND', `文件不存在：${input}`)
    }
    if (!isInside(realRoot, real)) throw new GrantError('PATH_ESCAPE', '路径通过符号链接逃逸工作区')
    if (!(await stat(real)).isFile()) throw new GrantError('NOT_A_FILE', `不是普通文件：${input}`)
    return { absolute: real, id: path.relative(realRoot, real).split(path.sep).join('/') }
  }

  /** 解析工作区内的目录。 */
  async resolveDirectory(input?: string): Promise<{ absolute: string; id: string }> {
    let realRoot: string
    try {
      realRoot = await realpath(this.config.workspaceRoot)
    } catch {
      throw new GrantError('NOT_FOUND', `工作区不存在：${this.config.workspaceRoot}`)
    }
    const candidate = path.resolve(realRoot, input ?? '.')
    if (!isInside(realRoot, candidate)) throw new GrantError('PATH_ESCAPE', '路径超出工作区')
    let real: string
    try {
      real = await realpath(candidate)
    } catch {
      throw new GrantError('NOT_FOUND', `目录不存在：${input ?? '.'}`)
    }
    if (!isInside(realRoot, real)) throw new GrantError('PATH_ESCAPE', '路径通过符号链接逃逸工作区')
    if (!(await stat(real)).isDirectory()) throw new GrantError('NOT_A_DIRECTORY', `不是目录：${input ?? '.'}`)
    return { absolute: real, id: path.relative(realRoot, real).split(path.sep).join('/') || '.' }
  }

  /**
   * 检查一份中文本子。
   * @param request - 文本或路径。
   * @returns 分析结果与证据。
   */
  async check(request: GrantCheckRequest): Promise<GrantCheckResult> {
    if ((request.text === undefined) === (request.path === undefined)) throw new GrantError('INVALID_INPUT', 'text 与 path 必须二选一')
    if (request.text !== undefined && typeof request.text !== 'string') throw new GrantError('INVALID_INPUT', 'text 必须是字符串')
    let text: string
    let sourceRef: AddEvidenceInput['sourceRef']
    let mediaType: Snapshot['mediaType'] = 'text/plain'
    if (request.text !== undefined) {
      if (request.text.length > this.config.maxChars) throw new GrantError('TOO_LARGE', `文本 ${request.text.length} 字，超过上限 ${this.config.maxChars}`)
      text = request.text
      sourceRef = { kind: 'other', id: 'inline:grant', retrievedAt: this.iso() }
    } else {
      const file = await this.resolveFile(request.path!)
      if (/\.(docx?|pdf)$/iu.test(file.id)) throw new GrantError('UNSUPPORTED_FILE', 'docx/pdf 不在此解析；请转成 .md/.txt，或先用 dsh-doc-anchor 抽文本')
      // 先按字节上限拒绝，避免在字符上限检查之前把超大文件读进内存。
      const byteCap = this.config.maxChars * 4
      const info = await stat(file.absolute)
      if (info.size > byteCap) throw new GrantError('TOO_LARGE', `文件 ${info.size} 字节，超过 ${byteCap} 字节读取上限（对应 ${this.config.maxChars} 字）`)
      text = await readFile(file.absolute, 'utf8')
      if (text.length > this.config.maxChars) throw new GrantError('TOO_LARGE', `本子 ${text.length} 字，超过上限 ${this.config.maxChars}`)
      mediaType = file.id.endsWith('.md') ? 'text/markdown' : 'text/plain'
      sourceRef = { kind: 'file', id: file.id, retrievedAt: this.iso() }
    }
    const analysis = analyzeGrant(text)
    const persist = request.persist ?? this.config.persist
    if (!persist) return { analysis }
    const checks: CheckResult[] = analysis.findings.map(finding => ({
      checkId: `chk-grant-${finding.id}`,
      check: 'other' as const,
      status: finding.status === 'present' ? ('pass' as const) : finding.severity === 'warning' ? ('warn' as const) : ('skipped' as const),
      severity: finding.severity === 'warning' ? ('warning' as const) : ('info' as const),
      detail: finding.status === 'present' ? `${finding.label} 已出现` : `${finding.label} 未出现——${finding.advice ?? ''}`,
      ...(finding.locator === undefined ? {} : { actual: { charStart: finding.locator.charStart, charEnd: finding.locator.charEnd } }),
    }))
    checks.push({ checkId: 'chk-grant-attribute', check: 'other', status: analysis.attributes.length === 0 ? 'warn' : 'pass', severity: analysis.attributes.length === 0 ? 'warning' : 'info', detail: `科学问题属性：${analysis.attributes.join('、') || '未识别'}`, actual: { scheme: analysis.scheme } })
    const port = this.port()
    try {
      const captured = await port.capture({ bytes: text, mediaType, sourceRef, capturedAt: this.iso() })
      const evidence = (
        await port.addEvidence({
          evidenceId: stableId('ev', ['grant-cn', sourceRef.id, captured.snapshot.snapshotId]),
          title: `基金本子检查（${analysis.scheme}，${analysis.present}/${analysis.total}）`,
          sourceRef,
          snapshotIds: [captured.snapshot.snapshotId],
          anchors: [{ snapshotId: captured.snapshot.snapshotId, kind: 'record', value: 'field:text' }],
          provenance: { plugin: 'dsh-grant-cn', version: VERSION, method: 'keyword-checklist', retrievedAt: this.iso() },
          checks,
          notes: `属性：${analysis.attributes.join('、') || '未识别'}；缺失核心项：${analysis.coreMissing.join('、') || '无'}`,
        })
      ).evidence
      const record = await port.buildRecord({ evidenceIds: [evidence.evidenceId] })
      if (!validateRep(record).ok) throw new GrantError('STORE_ERROR', '拒绝写入非法 REP 记录')
      const directory = path.join(this.config.root, 'records')
      await mkdir(directory, { recursive: true })
      const file = path.join(directory, `${evidence.evidenceId}.rep.json`)
      await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
      return { analysis, evidenceId: evidence.evidenceId, recordPath: file }
    } catch (error) {
      if (error instanceof GrantError) throw error
      if (error instanceof RepStoreError) throw new GrantError('STORE_ERROR', error.message)
      throw new GrantError('STORE_ERROR', `无法写入记录：${(error as Error).message}`)
    }
  }

  /**
   * 校验预算。
   * @param request - 科目与合计。
   * @returns 校验结果。
   */
  budget(request: BudgetRequest): BudgetResult {
    if (typeof request !== 'object' || request === null || !Array.isArray(request.items)) throw new GrantError('INVALID_INPUT', 'items 必须是数组')
    for (const item of request.items) {
      if (typeof item !== 'object' || item === null) throw new GrantError('INVALID_INPUT', 'items 的每一项必须是对象')
      if (typeof item.category !== 'string' || item.category.trim() === '') throw new GrantError('INVALID_INPUT', '每个预算科目都需要非空 category')
      if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0) throw new GrantError('INVALID_INPUT', `科目“${item.category}”的 amount 必须是非负有限数字`)
      if (item.note !== undefined && typeof item.note !== 'string') throw new GrantError('INVALID_INPUT', `科目“${item.category}”的 note 必须是字符串`)
    }
    if (request.categories !== undefined) {
      if (!Array.isArray(request.categories) || request.categories.some(category => typeof category !== 'string' || category.trim() === '')) {
        throw new GrantError('INVALID_INPUT', 'categories 必须是非空字符串数组')
      }
    }
    for (const [name, value] of [['totalDirect', request.totalDirect], ['totalIndirect', request.totalIndirect], ['total', request.total]] as const) {
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        throw new GrantError('INVALID_INPUT', `${name} 必须是非负有限数字`)
      }
    }
    return checkBudget(request)
  }

  /**
   * 扫描申请材料包并导出。
   * @param request - 目录。
   * @returns 材料报告与导出路径。
   */
  async pack(request: { path?: string } = {}): Promise<MaterialReport & { exports: { json: string; markdown: string } }> {
    const directory = await this.resolveDirectory(request.path)
    const report = await scanMaterials(directory.absolute)
    const exportsDirectory = path.join(this.config.root, 'exports')
    await mkdir(exportsDirectory, { recursive: true })
    const json = path.join(exportsDirectory, `materials-${report.rootId}.json`)
    const markdown = path.join(exportsDirectory, `materials-${report.rootId}.md`)
    await writeFile(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(markdown, renderMaterialsMarkdown(report), 'utf8')
    return { ...report, exports: { json, markdown } }
  }
}
