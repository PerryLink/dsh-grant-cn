# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-11-08

### Fixed

- pack scan cap.

## [0.1.1] - 2026-11-08

### Changed

- Release-engineering refresh: CHANGELOG accuracy, package metadata and authors; no runtime changes.

## [0.1.0] - 2026-11-08

### Fixed

- `detectScheme` checks 优青/杰青 before the generic 青年 pattern; both
  "优秀青年科学基金" and "国家杰出青年科学基金" contain "青年科学基金", so
  they were previously misreported as 青年.
- Validate budget items/categories/totals in the runtime: a string or NaN
  amount and a non-array category list now fail with `INVALID_INPUT` instead of
  crashing or poisoning the totals; invalid amounts contribute 0.
- A proposal file is rejected from its byte size before `readFile`, so the
  character cap cannot be bypassed by a huge file.
- `check` rejects a non-string `text` as `INVALID_INPUT`.

### Changed

- Test count is now 19; README/CHANGELOG list the new failure branches.

First release: the Chinese grant-application checklist.

### Added

- `grant_check`: 19-item starter checklist (title, abstract, science
  attribute A–D, rationale, objectives, content, plan, technical route,
  innovation, feasibility, foundation, conditions, team, budget, budget basis,
  ethics, data sharing, quota, references) with character locators, advice,
  coverage, detected attributes and scheme metadata.
- `grant_budget`: category/amount/duplicate checks plus direct/indirect/total
  consistency and budget-basis warnings. No policy ratio is hard-coded.
- `grant_pack`: application-pack scan (application, budget, ethics, commitment,
  CV, attachments) with JSON + Markdown exports.
- REP v1 integration: the checked proposal becomes immutable evidence with one
  check per item plus an attribute check; a valid record is written.
- 16 tests.

### Notes

- Keyword-based: a differently worded statement can be missed, and a hit does
  not prove the argument is adequate. This is not a review verdict.
- Eligibility rules (age, title, concurrent grants) and yearly budget ratios
  are deliberately not encoded; verify against the current guide.
