# dsh-grant-cn

**投稿/申报前：本子的检查清单是否齐、预算算术是否对、材料包是否真的打包了？**

*面向中文基金申请书（国家自然科学基金等）的起步清单：19 项结构/属性/声明检查、预算算术与结构校验、申请材料包扫描。关键词清单，不是评审结论。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24.9-brightgreen.svg)]()

English · [简体中文](README-zh.md)

---

## 它做什么

- **`grant_check`** — 检查 19 项：项目名称、摘要、**科学问题属性 A/B/C/D**、立项依据、研究目标、研究内容、研究方案、技术路线、创新点、可行性、研究基础、工作条件、申请人/团队、经费预算、预算说明、伦理、数据共享、限项、参考文献。命中项带字符定位，缺失项带建议；给出覆盖率、核心缺失项、识别到的属性与项目类型（青年/面上/重点/优青/杰青/其他，仅元数据）。
- **`grant_budget`** — 科目是否在允许列表、金额是否非负、是否重复、直接/间接/总经费是否与科目之和一致、是否有测算依据。默认科目：**设备费、业务费、劳务费、间接费用**（2021 年以来 NSFC 直接费用三类 + 间接费用），可用 `categories` 覆盖。
- **`grant_pack`** — 扫描材料目录：申请书正文、预算表、伦理批件、承诺书/声明、简历、代表性成果附件；缺失项分级 + 建议；输出 JSON + Markdown。

## 它不做什么

- **不做评审判断。** 关键词命中 ≠ 论证充分；换一种写法可能漏报。输出不预测“能否中标”。
- **不内置政策数字。** 间接费用比例、限项规则、年龄/职称资格都按当年指南执行，插件不写死；`grant_budget` 只校验算术与结构。
- **不解析 docx/pdf。** 转成 `.md`/`.txt` 再检查，PDF 可先用 `dsh-doc-anchor` 抽文本。
- **不上传、不转换、不改名。** 材料包只读扫描。
- **不替代官方模板。** 19 项是起步清单，不是基金委评审表。

## 检查项与严重级别

核心项（缺失为 warning）：项目名称、摘要、科学问题属性、立项依据、研究目标、研究内容、研究方案、技术路线、创新点、可行性、研究基础、经费预算、预算说明。
非核心项（缺失为 info）：工作条件、申请人/团队、伦理、数据共享、限项、参考文献。

## 工具

### `grant_check`

`{ text? | path?, persist? }` → `{ ok, analysis, evidenceId?, recordPath? }`。

### `grant_budget`

`{ items: [{category, amount, note?}], totalDirect?, totalIndirect?, total?, categories? }` → `{ ok, budget }`。
`budget.valid` 仅表示无 fail 级问题。

### `grant_pack`

`{ path? }` → `{ ok, materials, exports: {json, markdown} }`。

### 错误码

`INVALID_INPUT` · `NOT_FOUND` · `PATH_ESCAPE` · `NOT_A_FILE` · `NOT_A_DIRECTORY` · `TOO_LARGE` · `UNSUPPORTED_FILE` · `STORE_ERROR`

## 兼容性与安装

| | |
|---|---|
| DeepSeek Harness | **`dsh-v0.2.1-rc.5`**（2026-11-08 实测）；peer `>=0.2.1-0 <0.3.0 \|\| >=0.2.2-0 <0.3.0` |
| Node | `^22.19.0 \|\| >=24.9.0`（实测 `24.22.1`），仅 ESM |
| Peer | `@perrylink/dsh-research-core ^0.1.0`、`@deepseek-ai/cordis ^4.0.5-alpha.1`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery ^3.18.5-alpha.1` |
| 运行时依赖 | **零** |

```sh
dsh plugin --profile <name> add @perrylink/dsh-research-core dsh-grant-cn
dsh --profile <name> --dump-config | grep dsh-grant-cn
```

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | `false` 不挂载 |
| `root` | `.grant-cn` | 存储、记录、导出根 |
| `workspaceRoot` | `process.cwd()` | 路径必须落在其内 |
| `maxChars` | `1000000` | 字符上限（超限失败，不截断） |
| `persist` | `true` | 是否写入 REP 证据与记录 |

## 安全边界

- 本子只读；写入只发生在 `root` 下。
- `realpath` 路径包含，拒符号链接逃逸。
- docx/pdf 明确拒绝；超限失败而非截断。
- 材料包扫描只看文件名，不打开内容。

## 评测

**16 个测试**：中文编号章节切分、完整本子 19/19、空本子缺失与属性提示、四类属性与项目类型识别、预算（一致通过、合计不一致、负数、未知科目、重复科目、空预算、无测算依据）、runtime（合法 REP 记录、文件读取、越界/二进制/超限拒绝）、材料包扫描与导出、工具 schema 与失败分支、包契约。

不声称 benchmark：真值是“人工是否也认为该条缺失”，需要裁决语料；当前证据是单元 fixture。

## 已知限制（v0.1）

- 中文关键词检测；英文/中英混排本子会漏。
- 不校验资格（年龄、职称、在研项目数、限项规则）与当年指南的预算比例。
- 材料包按文件名与单层目录判断。
- 不检查图表清晰度、字体、页数等格式要求。

## 许可

Apache-2.0。运行时零第三方代码。
