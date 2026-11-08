/**
 * 共享 schema 片段。
 * @module dsh-grant-cn/tools/shared
 */

/** 失败分支。 */
export const ERROR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    code: { type: 'string', required: true },
    message: { type: 'string', required: true },
  },
} as const
