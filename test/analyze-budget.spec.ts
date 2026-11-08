/**
 * 本子分析、属性/类型识别、预算校验。
 * @module test/analyze-budget.spec
 */

import { describe, expect, it } from 'vitest'
import { analyzeGrant, detectAttributes, detectScheme, splitSections } from '../src/analyze.ts'
import { checkBudget } from '../src/budget.ts'

/** 一份完整的中文本子（合成数据）。 */
const GRANT = `# 国家自然科学基金申请书

项目名称：合成微生物群落的稳定构建

摘要：本项目研究合成微生物群落的稳定性。

一、科学问题属性：需求牵引、突破瓶颈（C 类）

二、立项依据：领域现状与研究假说。

三、研究目标：建立可预测的群落构建方法。

四、研究内容：分三条内容开展。

五、研究方案：设计、样本、方法与统计。

六、技术路线：见流程图。

七、创新点：方法与理论创新。

八、可行性分析：理论、技术与条件可行。

九、研究基础：前期已获数据。

十、工作条件：依托重点实验室平台。

十一、申请人简介：申请人长期从事相关研究。

十二、经费预算：设备费 10 万元，业务费 20 万元，劳务费 5 万元，间接费用 6 万元。

十三、预算说明：各科目测算依据见附表。

十四、伦理审查：不涉及人体与动物实验。

十五、数据共享：数据将汇交至公共数据库。

十六、限项说明：申请人无在研同类项目。

十七、参考文献：略。
`

describe('章节与条目', () => {
  it('按中文编号切分章节', () => {
    const sections = splitSections(GRANT)
    expect(sections.map(section => section.name)).toEqual(expect.arrayContaining(['rationale', 'content', 'plan', 'route', 'budget']))
  })

  it('完整本子命中全部 19 项并识别属性与项目类型', () => {
    const analysis = analyzeGrant(GRANT)
    expect(analysis.total).toBe(19)
    expect(analysis.present).toBe(19)
    expect(analysis.coverage).toBe(1)
    expect(analysis.attributes).toEqual(['C'])
    expect(analysis.coreMissing).toEqual([])
  })

  it('空本子大量缺失且提示未识别属性', () => {
    const analysis = analyzeGrant('只有一句话。')
    expect(analysis.present).toBeLessThan(5)
    expect(analysis.coreMissing.length).toBeGreaterThan(5)
    expect(analysis.notes.join(' ')).toContain('科学问题属性')
  })

  it('识别四类属性与项目类型', () => {
    expect(detectAttributes('鼓励探索、突出原创')).toEqual(['A'])
    expect(detectAttributes('聚焦前沿、独辟蹊径')).toEqual(['B'])
    expect(detectAttributes('需求牵引、突破瓶颈')).toEqual(['C'])
    expect(detectAttributes('共性导向、交叉融通')).toEqual(['D'])
    expect(detectScheme('国家自然科学基金青年科学基金项目')).toBe('青年')
    expect(detectScheme('优秀青年科学基金项目')).toBe('优青')
    expect(detectScheme('国家杰出青年科学基金项目')).toBe('杰青')
    expect(detectScheme('面上项目')).toBe('面上')
    expect(detectScheme('重点项目')).toBe('重点')
    expect(detectScheme('其他项目')).toBe('其他')
  })
})

describe('预算', () => {
  const items = [
    { category: '设备费', amount: 10, note: '设备清单' },
    { category: '业务费', amount: 20, note: '材料与测试' },
    { category: '劳务费', amount: 5, note: '研究生劳务' },
    { category: '间接费用', amount: 6 },
  ]

  it('合计一致时通过并给出直接/间接合计', () => {
    const result = checkBudget({ items, totalDirect: 35, totalIndirect: 6, total: 41 })
    expect(result.valid).toBe(true)
    expect(result.direct).toBe(35)
    expect(result.indirect).toBe(6)
    expect(result.total).toBe(41)
  })

  it('合计不一致时失败', () => {
    const result = checkBudget({ items, totalDirect: 40, total: 41 })
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('直接费用合计不一致')
  })

  it('负数、未知科目、重复科目、空预算都被报出', () => {
    const negative = checkBudget({ items: [{ category: '设备费', amount: -1 }] })
    expect(negative.valid).toBe(false)

    const unknown = checkBudget({ items: [{ category: '差旅费', amount: 10 }] })
    expect(unknown.valid).toBe(true)
    expect(unknown.checks.some(check => check.code === 'unknown-category')).toBe(true)

    const duplicate = checkBudget({ items: [...items, { category: '设备费', amount: 1 }] })
    expect(duplicate.checks.some(check => check.code === 'duplicate-category')).toBe(true)

    const empty = checkBudget({ items: [] })
    expect(empty.valid).toBe(false)
    expect(empty.checks.some(check => check.code === 'empty')).toBe(true)
  })

  it('没有测算依据时给出提醒', () => {
    const result = checkBudget({ items: [{ category: '设备费', amount: 10 }, { category: '间接费用', amount: 2 }] })
    expect(result.checks.some(check => check.code === 'no-basis')).toBe(true)
  })

  it('非法金额被报出且不会把合计变成 NaN', () => {
    const result = checkBudget({ items: [{ category: '设备费', amount: 10 }, { category: '业务费', amount: 'oops' as never }] })
    expect(result.valid).toBe(false)
    expect(Number.isFinite(result.direct)).toBe(true)
    expect(result.direct).toBe(10)
    expect(result.checks.some(check => check.code === 'invalid-amount')).toBe(true)
  })
})
