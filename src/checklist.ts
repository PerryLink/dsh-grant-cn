/**
 * 中文基金申请书检查清单。
 *
 * 这是**起步清单**（19 项），不是官方评审表：每项用中文关键词检测，换一种
 * 写法就可能漏报；命中关键词也不等于论证充分。输出只给“缺失/命中 + 定位 +
 * 建议”，不给“能否中标”的判断。
 *
 * 科学问题属性四类按 2020 年以来的国家自然科学基金分类编码，作为**选项**
 * 校验，不代替申请人的选择。
 *
 * @module dsh-grant-cn/checklist
 */

/** 一个检查项。 */
export interface GrantItem {
  /** 稳定 id。 */
  readonly id: string
  /** 中文名称。 */
  readonly label: string
  /** 检测用的中文/英文关键词（任一命中即视为“出现”）。 */
  readonly patterns: readonly RegExp[]
  /** 缺失时的建议。 */
  readonly advice: string
  /** 是否为核心项（缺失记为 warning，否则 info）。 */
  readonly core: boolean
}

/** 科学问题属性（四类）。 */
export const SCIENCE_ATTRIBUTES = [
  { id: 'A', label: '鼓励探索、突出原创' },
  { id: 'B', label: '聚焦前沿、独辟蹊径' },
  { id: 'C', label: '需求牵引、突破瓶颈' },
  { id: 'D', label: '共性导向、交叉融通' },
] as const

/** 科学问题属性 id。 */
export type ScienceAttribute = (typeof SCIENCE_ATTRIBUTES)[number]['id']

/** 项目类型（仅作元数据与提示，不做资格校验）。 */
export const SCHEMES = ['青年', '面上', '重点', '优青', '杰青', '其他'] as const

/** 项目类型。 */
export type Scheme = (typeof SCHEMES)[number]

/** 起步检查清单。 */
export const GRANT_ITEMS: readonly GrantItem[] = [
  { id: 'title', label: '项目名称', patterns: [/项目名称/u, /^#\s+\S/mu, /^题目/u], advice: '写清项目名称（与申请书封面一致）', core: true },
  { id: 'abstract', label: '摘要', patterns: [/摘\s*要/u], advice: '补中文摘要（400 字以内，含目标、内容、方法、意义）', core: true },
  { id: 'attribute', label: '科学问题属性', patterns: [/科学问题属性/u, /鼓励探索/u, /聚焦前沿/u, /需求牵引/u, /共性导向/u], advice: '选择并论证科学问题属性（A/B/C/D 四类之一）', core: true },
  { id: 'rationale', label: '立项依据', patterns: [/立项依据/u, /研究背景/u, /研究意义/u], advice: '补立项依据：领域现状、关键科学问题、研究假说', core: true },
  { id: 'objectives', label: '研究目标', patterns: [/研究目标/u, /总目标/u], advice: '写清研究目标（可检验、可结题）', core: true },
  { id: 'content', label: '研究内容', patterns: [/研究内容/u], advice: '分条列出研究内容，与目标一一对应', core: true },
  { id: 'plan', label: '研究方案', patterns: [/研究方案/u, /研究方法/u, /实验方案/u], advice: '补研究方案：设计、样本、方法、统计', core: true },
  { id: 'route', label: '技术路线', patterns: [/技术路线/u, /流程图/u], advice: '补技术路线（建议配流程图）', core: true },
  { id: 'innovation', label: '创新点', patterns: [/创新/u, /特色/u], advice: '写 2–3 条具体创新点（科学/方法/技术）', core: true },
  { id: 'feasibility', label: '可行性分析', patterns: [/可行性/u], advice: '补可行性分析：理论、技术、条件、团队', core: true },
  { id: 'foundation', label: '研究基础', patterns: [/研究基础/u, /工作基础/u, /前期基础/u], advice: '补前期工作基础（与本项目直接相关的数据/成果）', core: true },
  { id: 'conditions', label: '工作条件', patterns: [/工作条件/u, /实验条件/u, /平台/u], advice: '说明依托平台与实验条件', core: false },
  { id: 'team', label: '申请人/团队简介', patterns: [/申请人/u, /项目负责人/u, /研究团队/u, /课题组/u], advice: '补申请人简介与团队分工', core: false },
  { id: 'budget', label: '经费预算', patterns: [/经费预算/u, /预算/u], advice: '补经费预算表（设备费/业务费/劳务费/间接费用）', core: true },
  { id: 'budget-basis', label: '预算说明', patterns: [/预算说明/u, /测算依据/u, /测算说明/u], advice: '每一项预算给出测算依据', core: true },
  { id: 'ethics', label: '伦理审查', patterns: [/伦理/u, /知情同意/u, /动物实验/u], advice: '涉及人/动物研究需伦理批件编号或说明', core: false },
  { id: 'data', label: '数据共享', patterns: [/数据共享/u, /数据汇交/u, /开放获取/u, /数据管理/u], advice: '说明数据共享/汇交安排', core: false },
  { id: 'quota', label: '限项说明', patterns: [/限项/u, /申请限项/u, /在研项目/u], advice: '核对限项要求并说明在研项目', core: false },
  { id: 'references', label: '参考文献', patterns: [/参考文献/u, /References/iu], advice: '补参考文献（格式符合指南要求）', core: false },
]

/** 指南条目对应的统计。 */
export const CHECKLIST_VERSION = 'grant-cn/v0.1.0'

/**
 * 按 id 查检查项。
 * @param id - 检查项 id。
 * @returns 检查项或 undefined。
 */
export function itemOf(id: string): GrantItem | undefined {
  return GRANT_ITEMS.find(item => item.id === id)
}
