/**
 * Runtime 与工具面：证据、路径安全、材料包导出。
 * @module test/runtime-tools.spec
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { validateRep } from '@perrylink/dsh-research-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
import { GrantError, GrantRuntime } from '../src/runtime.ts'
import { makeGrantBudgetTool } from '../src/tools/grant-budget.ts'
import { makeGrantCheckTool } from '../src/tools/grant-check.ts'
import { makeGrantPackTool } from '../src/tools/grant-pack.ts'
import { VERSION } from '../src/version.ts'

const AT = new Date('2026-10-05T09:00:00.000Z')
const GRANT = '# 申请书\n\n项目名称：测试\n摘要：摘要。\n一、科学问题属性：鼓励探索、突出原创\n二、立项依据：依据\n三、研究目标：目标\n四、研究内容：内容\n五、研究方案：方案\n六、技术路线：路线\n七、创新点：创新\n八、可行性分析：可行\n九、研究基础：基础\n十、工作条件：条件\n十一、申请人简介：简介\n十二、经费预算：设备费 10\n十三、预算说明：测算依据\n十四、伦理审查：不涉及\n十五、数据共享：共享\n十六、限项说明：无限项\n十七、参考文献：略\n'
let workspace: string
let store: string

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'grant-work-'))
  store = await mkdtemp(path.join(tmpdir(), 'grant-store-'))
  await writeFile(path.join(workspace, 'grant.md'), GRANT, 'utf8')
})

afterEach(async () => {
  for (const directory of [workspace, store]) {
    if (directory.startsWith(tmpdir())) await rm(directory, { recursive: true, force: true })
  }
})

/** 构造 runtime。 */
function runtime(): GrantRuntime {
  return new GrantRuntime({ config: resolveConfig({ workspaceRoot: workspace, root: store }), now: () => AT })
}

const EXEC = {} as never

describe('runtime', () => {
  it('检查文本并写入合法 REP 记录', async () => {
    const result = await runtime().check({ text: GRANT })
    expect(result.analysis.present).toBe(19)
    expect(result.evidenceId).toMatch(/^ev-/u)
    const record = JSON.parse(await readFile(result.recordPath!, 'utf8')) as unknown
    expect(validateRep(record).ok, JSON.stringify(validateRep(record).issues)).toBe(true)
  })

  it('读取工作区文件并拒绝越界、二进制与超限', async () => {
    const result = await runtime().check({ path: 'grant.md' })
    expect(result.analysis.scheme).toBe('其他')
    await expect(runtime().check({ path: '../escape.md' })).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
    await writeFile(path.join(workspace, 'grant.docx'), 'docx', 'utf8')
    await expect(runtime().check({ path: 'grant.docx' })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' })
    const tiny = new GrantRuntime({ config: resolveConfig({ workspaceRoot: workspace, root: store, maxChars: 10 }), now: () => AT })
    await expect(tiny.check({ text: GRANT })).rejects.toMatchObject({ code: 'TOO_LARGE' })
    await writeFile(path.join(workspace, 'large.md'), 'x'.repeat(41), 'utf8')
    await expect(tiny.check({ path: 'large.md' })).rejects.toMatchObject({ code: 'TOO_LARGE' })
    await expect(runtime().check({})).rejects.toBeInstanceOf(GrantError)
  })

  it('拒绝非法预算字段而不是让 NaN 或字符串泄漏进合计', () => {
    expect(() => runtime().budget({ items: [{ category: '设备费', amount: '10' as never }] })).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }))
    expect(() => runtime().budget({ items: [], totalDirect: '10' as never })).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }))
    expect(() => runtime().budget({ items: [], categories: '设备费' as never })).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }))
  })

  it('扫描材料包并导出 JSON/Markdown', async () => {
    await writeFile(path.join(workspace, '申请书.md'), GRANT, 'utf8')
    await writeFile(path.join(workspace, '预算表.md'), '预算', 'utf8')
    await writeFile(path.join(workspace, '伦理批件.pdf'), 'pdf', 'utf8')
    const result = await runtime().pack()
    expect(result.ready).toBe(true)
    // Three materials plus the grant.md fixture created in beforeEach.
    expect(result.entries.length).toBe(4)
    const markdown = await readFile(result.exports.markdown, 'utf8')
    expect(markdown).toContain('申请材料包')
  })
})

describe('tools', () => {
  it('声明三个工具与 schema', () => {
    for (const [tool, name] of [
      [makeGrantCheckTool(runtime()), 'grant_check'],
      [makeGrantBudgetTool(runtime()), 'grant_budget'],
      [makeGrantPackTool(runtime()), 'grant_pack'],
    ] as const) {
      expect(tool.name).toBe(name)
      expect(Object.keys(tool.parameters).length).toBeGreaterThan(0)
      expect(tool.output.schema).toBeDefined()
    }
  })

  it('grant_budget 工具返回合计与失败数', async () => {
    const tool = makeGrantBudgetTool(runtime())
    const value = (await tool.execute({ items: [{ category: '设备费', amount: 10, note: '清单' }], totalDirect: 10 }, EXEC)) as {
      ok: true
      budget: { valid: boolean; direct: number }
    }
    expect(value.ok).toBe(true)
    expect(value.budget.valid).toBe(true)
    expect(value.budget.direct).toBe(10)
  })

  it('grant_pack 工具报告问题与导出路径', async () => {
    const tool = makeGrantPackTool(runtime())
    const value = (await tool.execute({}, EXEC)) as { ok: true; materials: { ready: boolean; issues: Array<{ code: string }> }; exports: { json: string } }
    expect(value.ok).toBe(true)
    expect(value.materials.ready).toBe(false)
    expect(value.materials.issues.some(issue => issue.code === 'no_application')).toBe(true)
    expect(value.exports.json).toContain('materials-')
  })

  it('失败分支带稳定错误码', async () => {
    const value = (await makeGrantCheckTool(runtime()).execute({}, EXEC)) as { ok: false; error: { code: string } }
    expect(value.ok).toBe(false)
    expect(value.error.code).toBe('INVALID_INPUT')
  })

  it('grant_budget 的非法金额返回 ok:false', async () => {
    const value = (await makeGrantBudgetTool(runtime()).execute({ items: [{ category: '设备费', amount: '10' }] }, EXEC)) as { ok: false; error: { code: string } }
    expect(value.ok).toBe(false)
    expect(value.error.code).toBe('INVALID_INPUT')
  })
})

describe('package', () => {
  it('版本与 bundle patch 契约', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(pkg['version']).toBe(VERSION)
    expect(pkg['dsh']).toEqual({ manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } })
    expect(pkg['dependencies']).toEqual({})
  })
})
