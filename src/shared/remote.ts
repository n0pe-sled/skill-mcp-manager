/**
 * Wire contract between the two halves of the Skill & MCP Manager: every RPC
 * method's invocation descriptor, payload types, and boundary validators.
 *
 * This module is deliberately dependency-free at runtime (pure JSON-safe data
 * plus tiny hand-rolled validators), because it is bundled into BOTH halves:
 * the node half (host registration) and the browser half (client `$mount`).
 * The client's Remote `$mount` requires strict codecs, so every descriptor
 * uses `{ mode: 'strict', schema }` with these validators.
 *
 * One service, `skillMcpManager`, exposes five methods:
 *   - listSkills()                      → SkillsSnapshot
 *   - addSkill(input)                   → SkillMutationOutcome
 *   - setSkillInvocable(input)          → SkillMutationOutcome
 *   - listMcpServers()                  → McpSnapshot
 *   - saveMcpServers(servers)           → McpSaveOutcome
 *
 * @module dsh-skill-mcp-manager/remote
 */

import type {
  InvocationDescriptor,
  RemoteResult,
  TypertSchema,
} from '@deepseek-ai/dsh-typert-protocol'

// ---- Skills ------------------------------------------------------------

/** How one skill is stored on disk under a root. */
export type SkillKind = 'bundle' | 'flat'

/** One discovered skill under a managed root. */
export interface SkillView {
  /** Kebab-case skill name (bundle directory or flat file basename). */
  readonly name: string
  /** Frontmatter `description` (empty when absent). */
  readonly description: string
  /** Absolute path of the containing root. */
  readonly root: string
  /** Human label of the containing root. */
  readonly rootLabel: string
  /** `bundle` = `<root>/<name>/SKILL.md`, `flat` = `<root>/<name>.md`. */
  readonly kind: SkillKind
  /** Absolute path of the skill's source file. */
  readonly path: string
  /** Effjective model-facing visibility from `disable-model-invocation`. */
  readonly modelInvocable: boolean
  /** Effective user-facing visibility from `user-invocable`. */
  readonly userInvocable: boolean
}

/** One scanned skill root. */
export interface SkillRootInfo {
  /** Stable label shown in the UI. */
  readonly name: string
  /** Absolute path. */
  readonly path: string
}

/** Full skills snapshot: roots, discovered skills, and per-root diagnostics. */
export interface SkillsSnapshot {
  readonly roots: readonly SkillRootInfo[]
  readonly skills: readonly SkillView[]
  /** Read/scan diagnostics so partial failures never hide the rest. */
  readonly errors: readonly string[]
}

/** A verbatim markdown file uploaded as a skill source. */
export interface SourceMarkdownFile {
  /** Original file name (display/validation only). */
  readonly name: string
  /** Full file text, verbatim (may carry its own `---` frontmatter). */
  readonly content: string
}

/**
 * Derived skill metadata from an uploaded file, returned so the form can be
 * pre-filled instead of requiring the user to retype the title/description.
 */
export interface SkillUploadPreview {
  /** Kebab-case suggested name (frontmatter `name`, else slugified H1/file name). */
  readonly name: string
  /** Description from frontmatter (empty when absent). */
  readonly description: string
  /** `whenToUse` from frontmatter, when present. */
  readonly whenToUse?: string
  /** Model-facing visibility from the file's `disable-model-invocation`. */
  readonly modelInvocable: boolean
  /** User-facing visibility from the file's `user-invocable`. */
  readonly userInvocable: boolean
}

/** Payload of one Add-skill request. */
export interface AddSkillInput {
  /** Kebab-case skill name (also the on-disk folder name). May be empty when
   * `sourceFile` is set — the host then derives it from the file. */
  readonly name: string
  /** Frontmatter `description`. */
  readonly description: string
  /** The SKILL.md body (markdown). Ignored by the host when `sourceFile` is set. */
  readonly body: string
  /** Optional frontmatter `whenToUse`. */
  readonly whenToUse?: string
  /** Model-facing visibility (`disable-model-invocation`); default true. */
  readonly modelInvocable?: boolean
  /** User-facing visibility (`user-invocable`); default true. */
  readonly userInvocable?: boolean
  /**
   * Optional uploaded markdown file. The host keeps the file's body verbatim,
   * preserves its frontmatter keys (custom keys), and applies the form's fields
   * (`name`/`description`/`whenToUse`/invocation) on top — falling back to the
   * file's frontmatter when a form field is empty.
   */
  readonly sourceFile?: SourceMarkdownFile
}

/** Payload of one invocation-visibility update. */
export interface SetSkillInvocableInput {
  /** Existing skill name. */
  readonly name: string
  /** New model-facing visibility (frontmatter `disable-model-invocation`). */
  readonly modelInvocable: boolean
  /** New user-facing visibility (frontmatter `user-invocable`). */
  readonly userInvocable: boolean
}

/** Result of a skill mutation (add / visibility update). */
export type SkillMutationOutcome =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly error: string }

// ---- MCP servers -------------------------------------------------------

/** Transport of one MCP server. */
export type McpTransport = 'stdio' | 'streamable-http'

/**
 * One MCP server definition the manager owns. This is what is stored in the
 * `dsh-skill-mcp-manager` settings namespace and projected into
 * `$DSH_HOME/cordis.patch.yml` as one `@deepseek-ai/dsh-mcp-client` instance.
 */
export interface McpServerDefinition {
  /** Stable row id: `dsh-mcp-manager-<serverName>`. */
  id: string
  /** MCP namespace; must match `[A-Za-z0-9_-]{1,32}`, unique across live instances. */
  serverName: string
  transport: McpTransport
  /** stdio only: executable to spawn. */
  command: string
  /** stdio only: arguments passed without shell interpolation. */
  args: string[]
  /** stdio only: extra env vars merged on top of scrubbed ambient env. */
  env: Record<string, string>
  /** stdio only: working directory for the child process. */
  cwd: string
  /** streamable-http only: MCP endpoint URL. */
  url: string
  /** streamable-http only: extra headers attached to MCP requests. */
  headers: Record<string, string>
  /** Per-tool-call timeout in ms (shared schema default 60000). */
  toolCallTimeoutMs: number
  /** Reject plugin activation when the initial connect/sync fails. */
  failOnStartupError: boolean
}

/** Effective loader phase of one mcp-client instance. */
export type McpServerPhase = 'active' | 'pending' | 'failed' | 'unknown'

/** One mcp-client instance as the loader currently sees it. */
export interface LiveMcpServer {
  /** Loader entry id (or the manager's row id when settings-only). */
  readonly id: string
  readonly serverName: string
  readonly phase: McpServerPhase
  /** True when this row's id is managed by this plugin. */
  readonly managed: boolean
  /** False when there is no live loader entry for the managed id. */
  readonly present: boolean
}

/** Full MCP snapshot: managed defs, live instances, bridge availability. */
export interface McpSnapshot {
  /** The managed definitions (settings source of truth). */
  readonly servers: readonly McpServerDefinition[]
  /** Live loader instances, including mcp rows not owned by the manager. */
  readonly live: readonly LiveMcpServer[]
  /** Whether `@deepseek-ai/dsh-mcp-client` resolves in this process. */
  readonly bridgeResolvable: boolean
  /** Absolute path of the patch file the manager writes. */
  readonly patchPath: string
  /** Non-fatal diagnostics (e.g. a manual serverName collision). */
  readonly warnings: readonly string[]
}

/** Result of saving the managed MCP server set. */
export type McpSaveOutcome =
  | {
    readonly ok: true
    /** Whether the settings write landed (host read-back verified). */
    readonly saved: boolean
    /** Whether the patch file was rewritten (true when a reconcile happened). */
    readonly applied: boolean
    readonly patchPath: string
  }
  | { readonly ok: false; readonly error: string }

/** Client-side unwrapped result of one Remote call, shared for panel callbacks. */
export type RemoteCallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

// ---- Service identity ---------------------------------------------------

/** Cordis service key of the receiver, also the wire namespace. */
export const SERVICE = 'skillMcpManager'

const PREFIX = `dsh-skill-mcp-manager#${SERVICE}.`

// ---- Validator helpers --------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isStringDict(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  return Object.values(value).every(isString)
}

// ---- Boundary validators ------------------------------------------------

function parseSkillView(value: unknown): SkillView {
  if (!isRecord(value)) throw new TypeError('skill must be a plain object')
  const { name, description, root, rootLabel, kind, path, modelInvocable, userInvocable } = value
  if (!isString(name) || !isString(description) || !isString(root) || !isString(rootLabel)
    || !isString(path) || (kind !== 'bundle' && kind !== 'flat')
    || !isBoolean(modelInvocable) || !isBoolean(userInvocable)) {
    throw new TypeError('skill has invalid fields')
  }
  return {
    name, description, root, rootLabel,
    kind: kind === 'bundle' ? 'bundle' : 'flat',
    path, modelInvocable, userInvocable,
  }
}

function parseSkillRoot(value: unknown): SkillRootInfo {
  if (!isRecord(value) || !isString(value.name) || !isString(value.path)) {
    throw new TypeError('skill root must have string name and path')
  }
  return { name: value.name, path: value.path }
}

/** Predicate form: true when {@link parseSkillView} accepts the value. */
function acceptsSkillView(value: unknown): boolean {
  try {
    parseSkillView(value)
    return true
  } catch {
    return false
  }
}

/** Predicate form: true when {@link parseSkillRoot} accepts the value. */
function acceptsSkillRoot(value: unknown): boolean {
  try {
    parseSkillRoot(value)
    return true
  } catch {
    return false
  }
}

function parseSkillsSnapshot(value: unknown): SkillsSnapshot {
  if (!isRecord(value)) throw new TypeError('skills snapshot must be a plain object')
  const { roots, skills, errors } = value
  if (!Array.isArray(roots) || !roots.every(acceptsSkillRoot)) {
    throw new TypeError('skills snapshot roots must be an array of skill roots')
  }
  if (!Array.isArray(skills) || !skills.every(acceptsSkillView)) {
    throw new TypeError('skills snapshot skills must be an array of skills')
  }
  if (!isStringArray(errors)) throw new TypeError('skills snapshot errors must be an array of strings')
  return { roots: roots as SkillRootInfo[], skills: skills as SkillView[], errors }
}

function parseMcpServerDefinition(value: unknown): McpServerDefinition {
  if (!isRecord(value)) throw new TypeError('mcp server must be a plain object')
  const { id, serverName, transport, command, args, env, cwd, url, headers, toolCallTimeoutMs, failOnStartupError } = value
  if (!isString(id) || !isString(serverName) || (transport !== 'stdio' && transport !== 'streamable-http')
    || !isString(command) || !isStringArray(args) || !isStringDict(env) || !isString(cwd)
    || !isString(url) || !isStringDict(headers)
    || typeof toolCallTimeoutMs !== 'number' || !Number.isFinite(toolCallTimeoutMs)
    || !isBoolean(failOnStartupError)) {
    throw new TypeError('mcp server has invalid fields')
  }
  return {
    id, serverName,
    transport: transport === 'stdio' ? 'stdio' : 'streamable-http',
    command, args, env, cwd, url, headers,
    toolCallTimeoutMs, failOnStartupError,
  }
}

/** Predicate form: true when {@link parseMcpServerDefinition} accepts the value. */
function acceptsMcpServer(value: unknown): boolean {
  try {
    parseMcpServerDefinition(value)
    return true
  } catch {
    return false
  }
}

function parseMcpSnapshot(value: unknown): McpSnapshot {
  if (!isRecord(value)) throw new TypeError('mcp snapshot must be a plain object')
  const { servers, live, bridgeResolvable, patchPath, warnings } = value
  if (!Array.isArray(servers) || !servers.every(acceptsMcpServer)) {
    throw new TypeError('mcp snapshot servers must be an array of mcp server definitions')
  }
  if (!isBoolean(bridgeResolvable) || !isString(patchPath) || !isStringArray(warnings)) {
    throw new TypeError('mcp snapshot has invalid scalar fields')
  }
  const parsedLive = (live as unknown[] | undefined ?? []).map((entry, index) => {
    if (!isRecord(entry) || !isString(entry.id) || !isString(entry.serverName)
      || (entry.phase !== 'active' && entry.phase !== 'pending' && entry.phase !== 'failed' && entry.phase !== 'unknown')
      || !isBoolean(entry.managed) || !isBoolean(entry.present)) {
      throw new TypeError(`mcp live entry ${String(index)} has invalid fields`)
    }
    return {
      id: entry.id, serverName: entry.serverName,
      phase: entry.phase as McpServerPhase,
      managed: entry.managed, present: entry.present,
    }
  })
  return { servers, live: parsedLive, bridgeResolvable, patchPath, warnings }
}

function parseSkillMutationOutcome(value: unknown): SkillMutationOutcome {
  if (!isRecord(value) || !isBoolean(value.ok)) throw new TypeError('skill mutation outcome must be a plain object with ok')
  if (value.ok) {
    if (!isString(value.path)) throw new TypeError('skill mutation outcome ok result must carry a string path')
    return { ok: true, path: value.path }
  }
  if (!isString(value.error)) throw new TypeError('skill mutation outcome error must be a string')
  return { ok: false, error: value.error }
}

function parseMcpSaveOutcome(value: unknown): McpSaveOutcome {
  if (!isRecord(value) || !isBoolean(value.ok)) throw new TypeError('mcp save outcome must be a plain object with ok')
  if (value.ok) {
    if (!isBoolean(value.saved) || !isBoolean(value.applied) || !isString(value.patchPath)) {
      throw new TypeError('mcp save outcome ok result has invalid fields')
    }
    return { ok: true, saved: value.saved, applied: value.applied, patchPath: value.patchPath }
  }
  if (!isString(value.error)) throw new TypeError('mcp save outcome error must be a string')
  return { ok: false, error: value.error }
}

function parseSourceMarkdownFile(value: unknown): SourceMarkdownFile {
  if (!isRecord(value) || !isString(value.name) || !isString(value.content)) {
    throw new TypeError('source file must be an object with string name and content')
  }
  return { name: value.name, content: value.content }
}

function parseSkillUploadPreview(value: unknown): SkillUploadPreview {
  if (!isRecord(value) || !isString(value.name) || !isString(value.description)
    || !isBoolean(value.modelInvocable) || !isBoolean(value.userInvocable)) {
    throw new TypeError('upload preview must have string name/description and two booleans')
  }
  const preview: SkillUploadPreview = {
    name: value.name,
    description: value.description,
    modelInvocable: value.modelInvocable,
    userInvocable: value.userInvocable,
  }
  if (value.whenToUse !== undefined) {
    if (!isString(value.whenToUse)) throw new TypeError('upload preview whenToUse must be a string')
    return { ...preview, whenToUse: value.whenToUse }
  }
  return preview
}

function parseAddSkillInput(value: unknown): AddSkillInput {
  if (!isRecord(value)) throw new TypeError('add-skill input must be a plain object')
  const { name, description, body, whenToUse, modelInvocable, userInvocable, sourceFile } = value
  if (!isString(name) || !isString(description) || !isString(body)) {
    throw new TypeError('add-skill input name, description and body must be strings')
  }
  const optional: {
    whenToUse?: string
    modelInvocable?: boolean
    userInvocable?: boolean
    sourceFile?: SourceMarkdownFile
  } = {}
  if (whenToUse !== undefined) {
    if (!isString(whenToUse)) throw new TypeError('add-skill input whenToUse must be a string')
    optional.whenToUse = whenToUse
  }
  if (modelInvocable !== undefined) {
    if (!isBoolean(modelInvocable)) throw new TypeError('add-skill input modelInvocable must be a boolean')
    optional.modelInvocable = modelInvocable
  }
  if (userInvocable !== undefined) {
    if (!isBoolean(userInvocable)) throw new TypeError('add-skill input userInvocable must be a boolean')
    optional.userInvocable = userInvocable
  }
  if (sourceFile !== undefined) optional.sourceFile = parseSourceMarkdownFile(sourceFile)
  return { name, description, body, ...optional }
}

function parseSetSkillInvocableInput(value: unknown): SetSkillInvocableInput {
  if (!isRecord(value) || !isString(value.name) || !isBoolean(value.modelInvocable) || !isBoolean(value.userInvocable)) {
    throw new TypeError('set-skill-invocable input must be a plain object with name and two booleans')
  }
  return { name: value.name, modelInvocable: value.modelInvocable, userInvocable: value.userInvocable }
}

function parseMcpServerList(value: unknown): McpServerDefinition[] {
  if (!Array.isArray(value) || !value.every(acceptsMcpServer)) {
    throw new TypeError('servers must be an array of mcp server definitions')
  }
  return value as McpServerDefinition[]
}

// ---- Descriptors ---------------------------------------------------------

type TypertSchemaBoundary<T> = TypertSchema<T>

const SKILLS_SNAPSHOT_SCHEMA: TypertSchemaBoundary<SkillsSnapshot> = { parse: parseSkillsSnapshot }
const SKILL_MUTATION_SCHEMA: TypertSchemaBoundary<SkillMutationOutcome> = { parse: parseSkillMutationOutcome }
const SKILL_UPLOAD_PREVIEW_SCHEMA: TypertSchemaBoundary<SkillUploadPreview> = { parse: parseSkillUploadPreview }
const MCP_SNAPSHOT_SCHEMA: TypertSchemaBoundary<McpSnapshot> = { parse: parseMcpSnapshot }
const MCP_SAVE_SCHEMA: TypertSchemaBoundary<McpSaveOutcome> = { parse: parseMcpSaveOutcome }

/** The one descriptor each method needs: generated-style identity + strict codecs. */
function descriptor<R>(
  method: string,
  parameters: InvocationDescriptor['parameters'],
  result: TypertSchemaBoundary<R>,
): InvocationDescriptor {
  return {
    id: `${PREFIX}${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: { mode: 'strict', typeSymbol: `dsh-skill-mcp-manager#${method}`, schema: result },
  }
}

export const DESCRIPTORS: readonly InvocationDescriptor[] = [
  descriptor('listSkills', [], SKILLS_SNAPSHOT_SCHEMA),
  descriptor('addSkill', [{
    name: 'input',
    wire: 'input',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-skill-mcp-manager#AddSkillInput', schema: { parse: parseAddSkillInput } },
  }], SKILL_MUTATION_SCHEMA),
  descriptor('previewSkillUpload', [{
    name: 'source',
    wire: 'source',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-skill-mcp-manager#SourceMarkdownFile', schema: { parse: parseSourceMarkdownFile } },
  }], SKILL_UPLOAD_PREVIEW_SCHEMA),
  descriptor('setSkillInvocable', [{
    name: 'input',
    wire: 'input',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-skill-mcp-manager#SetSkillInvocableInput', schema: { parse: parseSetSkillInvocableInput } },
  }], SKILL_MUTATION_SCHEMA),
  descriptor('listMcpServers', [], MCP_SNAPSHOT_SCHEMA),
  descriptor('saveMcpServers', [{
    name: 'servers',
    wire: 'servers',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-skill-mcp-manager#McpServerList', schema: { parse: parseMcpServerList } },
  }], MCP_SAVE_SCHEMA),
]

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'skillMcpManager/listSkills'(): Promise<RemoteResult<SkillsSnapshot>>
    'skillMcpManager/addSkill'(input: AddSkillInput): Promise<RemoteResult<SkillMutationOutcome>>
    'skillMcpManager/previewSkillUpload'(source: SourceMarkdownFile): Promise<RemoteResult<SkillUploadPreview>>
    'skillMcpManager/setSkillInvocable'(input: SetSkillInvocableInput): Promise<RemoteResult<SkillMutationOutcome>>
    'skillMcpManager/listMcpServers'(): Promise<RemoteResult<McpSnapshot>>
    'skillMcpManager/saveMcpServers'(servers: McpServerDefinition[]): Promise<RemoteResult<McpSaveOutcome>>
  }
  interface TypertRemoteNamespaceMap {
    skillMcpManager: {
      listSkills(): Promise<RemoteResult<SkillsSnapshot>>
      addSkill(input: AddSkillInput): Promise<RemoteResult<SkillMutationOutcome>>
      previewSkillUpload(source: SourceMarkdownFile): Promise<RemoteResult<SkillUploadPreview>>
      setSkillInvocable(input: SetSkillInvocableInput): Promise<RemoteResult<SkillMutationOutcome>>
      listMcpServers(): Promise<RemoteResult<McpSnapshot>>
      saveMcpServers(servers: McpServerDefinition[]): Promise<RemoteResult<McpSaveOutcome>>
    }
  }
}
