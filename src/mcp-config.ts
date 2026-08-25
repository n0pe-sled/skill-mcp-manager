/**
 * MCP patch-layer management: the manager's MCP servers are projected into the
 * machine-global user patch file (`$DSH_HOME/cordis.patch.yml`) as
 * `@deepseek-ai/dsh-mcp-client` insert rows. This module owns that projection —
 * the exact js-yaml dialect the loaded include uses (`!!js` expressions must
 * round-trip verbatim), ownership detection, and the read-modify-write plan
 * that never touches rows the manager does not own and never rewrites a file
 * that is already in sync.
 */

import * as yaml from 'js-yaml'
import type { McpServerDefinition, McpTransport } from './shared/remote.ts'

/** Id prefix of every row this manager owns. */
export const MANAGER_ID_PREFIX = 'dsh-mcp-manager-'
/** The bridge plugin module name each managed row instantiates. */
export const MCP_CLIENT_NAME = '@deepseek-ai/dsh-mcp-client'
/** serverName contract from `dsh-mcp-client`. */
export const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/
/** Schema default per-tool-call timeout; only written when it differs. */
export const DEFAULT_TOOL_CALL_TIMEOUT_MS = 60000

/**
 * A serialized loader JavaScript expression (`!!js` scalar). Matches the
 * cordis-plugin-loader `JsExpr` shape so the include and this manager share
 * one dialect.
 */
export interface JsExprNode {
  __jsExpr: string
}

function isJsExprNode(value: unknown): value is JsExprNode {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>)['__jsExpr'] === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The entry-list YAML dialect: `!!js` scalars round-trip as expression nodes. */
const JsExpr = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  resolve: (data: unknown): boolean => typeof data === 'string',
  construct: (data: unknown): JsExprNode => ({ __jsExpr: data as string }),
  predicate: (data: unknown): data is JsExprNode => isJsExprNode(data),
  represent: (data: unknown): string => (data as JsExprNode).__jsExpr,
})
/** Schema for both load and dump — mirrors `app-boot`'s `entryListSchema`. */
export const patchSchema = yaml.JSON_SCHEMA.extend(JsExpr)

/** Stable loader row id for one managed server. */
export function rowIdFor(serverName: string): string {
  return `${MANAGER_ID_PREFIX}${serverName}`
}

/** Whether a patch row is a row this manager owns. */
export function isManagedRow(row: unknown): boolean {
  if (!isRecord(row)) return false
  return row.name === MCP_CLIENT_NAME
    && typeof row.id === 'string'
    && row.id.startsWith(MANAGER_ID_PREFIX)
}

/** Build the loader row for one managed server (omits schema defaults). */
export function configRowFor(def: McpServerDefinition): Record<string, unknown> {
  const config: Record<string, unknown> = {
    transport: def.transport,
    serverName: def.serverName,
  }
  if (def.transport === 'stdio') {
    config.command = def.command
    if (def.args.length > 0) config.args = [...def.args]
    if (Object.keys(def.env).length > 0) config.env = { ...def.env }
    if (def.cwd !== '') config.cwd = def.cwd
  } else {
    config.url = def.url
    if (Object.keys(def.headers).length > 0) config.headers = { ...def.headers }
  }
  if (def.toolCallTimeoutMs !== DEFAULT_TOOL_CALL_TIMEOUT_MS) config.toolCallTimeoutMs = def.toolCallTimeoutMs
  if (def.failOnStartupError) config.failOnStartupError = true
  return config
}

/** The patch row the loader mounts for one managed server. */
export function managedRowFor(def: McpServerDefinition): Record<string, unknown> {
  return { id: rowIdFor(def.serverName), name: MCP_CLIENT_NAME, config: configRowFor(def) }
}

/**
 * Collect every managed row in a parsed patch list, whether it sits at the top
 * level or inside an `insert:` list.
 */
export function collectManagedRows(rows: readonly unknown[]): unknown[] {
  const found: unknown[] = []
  for (const row of rows) {
    if (isManagedRow(row)) {
      found.push(row)
    } else if (isRecord(row) && Array.isArray(row.insert)) {
      for (const item of row.insert) {
        if (isManagedRow(item)) found.push(item)
      }
    }
  }
  return found
}

/** The patch list minus every managed row (top-level or inside insert lists). */
export function withoutManagedRows(rows: readonly unknown[]): unknown[] {
  const kept: unknown[] = []
  for (const row of rows) {
    if (isManagedRow(row)) continue
    if (isRecord(row) && Array.isArray(row.insert)) {
      const clean = row.insert.filter(item => !isManagedRow(item))
      if (clean.length > 0) kept.push({ ...row, insert: clean })
      continue
    }
    kept.push(row)
  }
  return kept
}

/** Parse the patch file text with the include dialect. */
export function parsePatchList(text: string | undefined): unknown[] {
  if (text === undefined || text.trim() === '') return []
  const parsed: unknown = yaml.load(text, { schema: patchSchema })
  return Array.isArray(parsed) ? parsed : []
}

/** Serialize a patch list with the include dialect. */
export function dumpPatchList(rows: readonly unknown[]): string {
  return yaml.dump(rows, { schema: patchSchema, noRefs: true })
}

/** Header printed above the managed insert block so hand edits are guided. */
export const PATCH_HEADER = [
  '# Managed by dsh-skill-mcp-manager: rows prefixed `dsh-mcp-manager-` are',
  '# generated from the plugin\'s settings and rewritten on the next save in the',
  '# DSH web GUI. Everything else in this file is preserved verbatim.',
  '',
].join('\n')

export interface PatchPlan {
  /** The full new file content (with header) when `changed` is true. */
  readonly content: string
  /** Whether the file needs rewriting. */
  readonly changed: boolean
  /** Identical to `changed` but explicit about the no-op reason for tests. */
  readonly reason: 'in-sync' | 'write-managed' | 'remove-stale'
}

/** Whether two managed-row lists are semantically identical. */
function sameManagedSet(a: readonly unknown[], b: readonly unknown[]): boolean {
  const keyOf = (value: unknown): string => JSON.stringify(value)
  const left = a.map(keyOf).sort()
  const right = b.map(keyOf).sort()
  if (left.length !== right.length) return false
  return left.every((key, index) => key === right[index])
}

/**
 * Produce the patch plan for one reconcile against the current file text.
 *
 * Rule: never touch a file that is already in sync. The file is rewritten only
 * when (a) managed settings need to be written, or (b) stale managed rows must
 * be removed — never merely to re-serialize an untouched file (that would strip
 * the user's comments on every startup).
 */
export function planPatch(
  existingText: string | undefined,
  managed: readonly McpServerDefinition[],
): PatchPlan {
  const base = parsePatchList(existingText)
  const existingManaged = collectManagedRows(base)
  const newManaged = managed.map(managedRowFor)
  const needToWrite = newManaged.length > 0
  const hasStale = existingManaged.length > 0 && !needToWrite
  if (!needToWrite && !hasStale) {
    return { content: '', changed: false, reason: 'in-sync' }
  }
  if (needToWrite && sameManagedSet(existingManaged, newManaged)) {
    return { content: '', changed: false, reason: 'in-sync' }
  }
  const kept = withoutManagedRows(base)
  const body: unknown[] = [...kept]
  if (newManaged.length > 0) {
    body.push({ insert: newManaged })
  }
  return {
    content: `${PATCH_HEADER}${dumpPatchList(body)}`,
    changed: true,
    reason: hasStale ? 'remove-stale' : 'write-managed',
  }
}

/** Validate one complete server set for save (first error wins). */
export function validateServerSet(
  servers: readonly McpServerDefinition[],
): string | null {
  const names = new Set<string>()
  for (const def of servers) {
    if (!SERVER_NAME_RE.test(def.serverName)) {
      return `serverName "${def.serverName}" must match [A-Za-z0-9_-]{1,32}`
    }
    if (rowIdFor(def.serverName) !== def.id) {
      return `server "${def.serverName}" has a malformed id`
    }
    if (names.has(def.serverName)) {
      return `serverName "${def.serverName}" is duplicated — each server needs a unique namespace`
    }
    names.add(def.serverName)
    if (def.transport === 'stdio' && def.command.trim() === '') {
      return `server "${def.serverName}" (stdio) needs a command`
    }
    if (def.transport === 'streamable-http') {
      let url: URL
      try {
        url = new URL(def.url)
      } catch {
        return `server "${def.serverName}" has an invalid url`
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return `server "${def.serverName}" needs an http(s) url`
      }
    }
  }
  return null
}

/** Normalize one transport value. */
export function isTransport(value: unknown): value is McpTransport {
  return value === 'stdio' || value === 'streamable-http'
}
