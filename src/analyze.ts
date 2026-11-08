/**
 * 本子分析：章节、检查项命中、科学问题属性、项目类型。
 *
 * 命中是关键词层面的；输出带字符定位，便于回到原文核对。
 *
 * @module dsh-grant-cn/analyze
 */

import { GRANT_ITEMS, SCIENCE_ATTRIBUTES, SCHEMES, type GrantItem, type Scheme, type ScienceAttribute } from './checklist.ts'

/** 一个章节范围。 */
export interface GrantSection {
  readonly name: string
  readonly heading: string
  readonly start: number
  readonly end: number
}

/** 一个检查项结果。 */
export interface GrantFinding {
  readonly id: string
  readonly label: string
  readonly status: 'present' | 'missing'
  readonly severity: 'info' | 'warning'
  readonly locator?: { readonly charStart: number; readonly charEnd: number; readonly match: string }
  readonly advice?: string
}

/** 分析结果。 */
export interface GrantAnalysis {
  readonly sections: readonly GrantSection[]
  readonly findings: readonly GrantFinding[]
  readonly present: number
  readonly total: number
  readonly coverage: number
  readonly coreMissing: readonly string[]
  readonly attributes: readonly ScienceAttribute[]
  readonly scheme: Scheme
  readonly wordCount: number
  readonly notes: readonly string[]
}

/** 章节名与标题关键词。 */
const SECTION_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'abstract', pattern: /摘\s*要/u },
  { name: 'rationale', pattern: /立项依据|研究背景|研究意义/u },
  { name: 'content', pattern: /研究内容/u },
  { name: 'objectives', pattern: /研究目标/u },
  { name: 'plan', pattern: /研究方案|研究方法|实验方案/u },
  { name: 'route', pattern: /技术路线/u },
  { name: 'innovation', pattern: /创新|特色/u },
  { name: 'feasibility', pattern: /可行性/u },
  { name: 'foundation', pattern: /研究基础|工作基础|前期基础/u },
  { name: 'conditions', pattern: /工作条件|实验条件/u },
  { name: 'team', pattern: /申请人|项目负责人|研究团队/u },
  { name: 'budget', pattern: /经费预算|预算/u },
  { name: 'ethics', pattern: /伦理/u },
  { name: 'data', pattern: /数据共享|数据汇交/u },
  { name: 'quota', pattern: /限项/u },
  { name: 'references', pattern: /参考文献/u },
]

/** 标题行。 */
interface Heading {
  readonly name: string
  readonly heading: string
  readonly index: number
}

/**
 * 切分章节：支持 Markdown 标题、中文“一、”“（一）”与“1.”编号。
 * @param text - 本子全文。
 * @returns 章节列表（无标题时为空）。
 */
export function splitSections(text: string): GrantSection[] {
  const headings: Heading[] = []
  const push = (heading: string, index: number): void => {
    const name = SECTION_PATTERNS.find(entry => entry.pattern.test(heading))?.name ?? heading.toLowerCase().slice(0, 30)
    headings.push({ name, heading: heading.trim(), index })
  }
  for (const match of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gmu)) push(match[1]!, match.index)
  for (const match of text.matchAll(/^[一二三四五六七八九十]+[、.．][ \t]*(.+?)[ \t]*$/gmu)) push(match[1]!, match.index)
  for (const match of text.matchAll(/^\d{1,2}[、.．][ \t]*(.+?)[ \t]*$/gmu)) push(match[1]!, match.index)
  headings.sort((left, right) => left.index - right.index)
  return headings.map((heading, index) => ({
    name: heading.name,
    heading: heading.heading,
    start: heading.index,
    end: headings[index + 1]?.index ?? text.length,
  }))
}

/** 检查一个条目。 */
function checkItem(text: string, item: GrantItem): GrantFinding {
  for (const pattern of item.patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (match !== null) {
      return {
        id: item.id,
        label: item.label,
        status: 'present',
        severity: 'info',
        locator: { charStart: match.index, charEnd: match.index + match[0].length, match: match[0].slice(0, 40) },
      }
    }
  }
  return { id: item.id, label: item.label, status: 'missing', severity: item.core ? 'warning' : 'info', advice: item.advice }
}

/** 识别科学问题属性（可多选，但正常应只选一类）。 */
export function detectAttributes(text: string): ScienceAttribute[] {
  const found: ScienceAttribute[] = []
  for (const attribute of SCIENCE_ATTRIBUTES) {
    const patterns: Record<ScienceAttribute, RegExp> = {
      A: /鼓励探索|突出原创/u,
      B: /聚焦前沿|独辟蹊径/u,
      C: /需求牵引|突破瓶颈/u,
      D: /共性导向|交叉融通/u,
    }
    if (patterns[attribute.id].test(text)) found.push(attribute.id)
  }
  return found
}

/** 识别项目类型（仅作元数据）。 */
export function detectScheme(text: string): Scheme {
  if (/青年科学基金|青年基金|青年项目/u.test(text)) return '青年'
  if (/优秀青年科学基金|优青/u.test(text)) return '优青'
  if (/国家杰出青年|杰青/u.test(text)) return '杰青'
  if (/重点项目|重点支持/u.test(text)) return '重点'
  if (/面上项目/u.test(text)) return '面上'
  return SCHEMES[5]
}

/**
 * 分析一份中文本子。
 * @param text - 本子全文。
 * @returns 章节、条目结果、属性与项目类型。
 */
export function analyzeGrant(text: string): GrantAnalysis {
  const sections = splitSections(text)
  const findings = GRANT_ITEMS.map(item => checkItem(text, item))
  const present = findings.filter(finding => finding.status === 'present').length
  const coverage = Number((present / GRANT_ITEMS.length).toFixed(4))
  const coreMissing = findings.filter(finding => finding.status === 'missing' && finding.severity === 'warning').map(finding => finding.id)
  const attributes = detectAttributes(text)
  const scheme = detectScheme(text)
  const wordCount = text.replace(/\s/gu, '').length
  const notes: string[] = ['检测基于中文关键词，换一种写法可能漏报；命中关键词也不代表论证充分', '本清单为起步清单（19 项），不是官方评审表']
  if (sections.length === 0) notes.push('未识别到章节标题，检查项按全文匹配')
  if (attributes.length === 0) notes.push('未识别到科学问题属性（A/B/C/D）')
  if (attributes.length > 1) notes.push(`识别到多个科学问题属性（${attributes.join('、')}），申请书通常只选一类`)
  return { sections, findings, present, total: GRANT_ITEMS.length, coverage, coreMissing, attributes, scheme, wordCount, notes }
}
