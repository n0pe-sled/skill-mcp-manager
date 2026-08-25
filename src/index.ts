/**
 * Host (Node) half of the Skill & MCP Manager plugin.
 *
 * - **Skills**: scans the configured user skill roots (`~/.agents/skills` by
 *   default), lists them, creates new `SKILL.md` bundles (`addSkill`), and
 *   flips each skill's model/user invocation visibility by rewriting its
 *   frontmatter (`setSkillInvocable`). No compatibility logic is needed on the
 *   catalog side: `@deepseek-ai/dsh-skill-filesystem` watches these roots and
 *   invalidates discovery on exactly these changes.
 * - **MCP servers**: the durable source of truth is the `skill-mcp-manager`
 *   settings namespace (`mcpServers`). After every change the manager projects
 *   the set into `$DSH_HOME/cordis.patch.yml` as `@deepseek-ai/dsh-mcp-client`
 *   insert rows (never touching rows it does not own; never rewriting an
 *   already-in-sync file). DSH's own user-patch HMR watcher
 *   (`watchUserPatches` in app-boot) hot-applies that file, so added servers
 *   connect and removed ones disconnect without a restart.
 *
 * All reads/writes across both surfaces flow through a runtime-registered
 * Typert endpoint (`skillMcpManager`) consumed by the browser half.
 */

import path from 'node:path'
import os from 'node:os'
import {
  mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync,
} from 'node:fs'
import Schema from '@deepseek-ai/schemastery'
import type z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
// Type-only: pull the ctx.settings / ctx.typert Context merges and events.
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-typert-registry'
import type { TypertContribution, TypertPackageModel } from '@deepseek-ai/dsh-typert-registry'
import { bindTypertRemote, type TypertGatewayBinding } from '@deepseek-ai/dsh-typert-protocol'
import {
  buildSkillDoc, buildSkillDocFromParts, FLAT_SKILL_EXT, invocationOf, isValidSkillName, parseSkillDoc, SKILL_FILE,
  setSkillInvocation,
} from './skill-fmt.ts'
import { MANAGER_ID_PREFIX, MCP_CLIENT_NAME, planPatch, rowIdFor, validateServerSet } from './mcp-config.ts'
import { DESCRIPTORS, SERVICE } from './shared/remote.ts'
import type {
  AddSkillInput, LiveMcpServer, McpSaveOutcome, McpServerDefinition, McpSnapshot,
  McpServerPhase, SetSkillInvocableInput, SkillMutationOutcome, SkillRootInfo, SkillsSnapshot, SkillView,
} from './shared/remote.ts'

export { buildSkillDoc, parseSkillDoc, setSkillInvocation } from './skill-fmt.ts'
export { planPatch, validateServerSet } from './mcp-config.ts'
export type {
  AddSkillInput, LiveMcpServer, McpSaveOutcome, McpServerDefinition, McpSnapshot,
  McpServerPhase, SetSkillInvocableInput, SkillMutationOutcome, SkillRootInfo, SkillsSnapshot, SkillView,
} from './shared/remote.ts'

export const name = 'skill-mcp-manager'

/** Services that must be mounted before this plugin runs. */
export const inject = ['settings', 'typert']

/** Config: which skill roots to manage and which patch file to project into. */
export interface Config {
  /** Absolute or `~`-prefixed skill roots to list/manage. Empty → `~/.agents/skills`. */
  skillRoots: string[]
  /** Absolute target patch file. Empty → `$DSH_HOME/cordis.patch.yml`. */
  mcpPatchTarget: string
}
export const Config: z<Config> = Schema.object({
  skillRoots: Schema.array(Schema.string()).default([]),
  mcpPatchTarget: Schema.string().default(''),
})

/** Persistent settings section owned by this plugin. */
export interface SettingsSection {
  mcpServers: McpServerDefinition[]
}

const NAMESPACE = settingsNamespace('skill-mcp-manager')

const mcpServerSchema = Schema.object({
  id: Schema.string(),
  serverName: Schema.string(),
  transport: Schema.union(['stdio', 'streamable-http']),
  command: Schema.string().default(''),
  args: Schema.array(Schema.string()).default([]),
  env: Schema.dict(Schema.string()).default({}),
  cwd: Schema.string().default(''),
  url: Schema.string().default(''),
  headers: Schema.dict(Schema.string()).default({}),
  toolCallTimeoutMs: Schema.number().default(60000),
  failOnStartupError: Schema.boolean().default(false),
}) as unknown as z<McpServerDefinition>

const sectionSchema: z<SettingsSection> = Schema.object({
  mcpServers: Schema.array(mcpServerSchema).default([]),
})

/** Empty model for the Typert contribution: no generated reflection is claimed. */
const EMPTY_MODEL: TypertPackageModel = { services: [], events: [], objects: [] }

/** Sanity cap on an uploaded skill markdown file (keeps RPC payloads bounded). */
const MAX_UPLOAD_BYTES = 1024 * 1024

/** Structural slice of the Loader we need (avoids importing loader types). */
interface LoaderLike {
  entries(): readonly LoaderEntryLike[]
}
interface LoaderEntryLike {
  readonly options: {
    readonly id?: unknown
    readonly name?: unknown
    readonly config?: { serverName?: unknown }
  }
  readonly disabled: boolean
  readonly fiber?: { readonly state?: number }
}

/** Fiber state values mirrored from cordis (const enum has no runtime object). */
const FIBER_PENDING = 0
const FIBER_LOADING = 1
const FIBER_ACTIVE = 2
const FIBER_FAILED = 3

/** The live receiver object the gateway dispatches `/api/skillMcpManager/*` to. */
interface SkillMcpManagerReceiver {
  /** Set after construction — the binding must reference the receiver itself. */
  typertRemote: TypertGatewayBinding<SkillMcpManagerReceiver>
  listSkills(): Promise<SkillsSnapshot>
  addSkill(input: AddSkillInput): Promise<SkillMutationOutcome>
  setSkillInvocable(input: SetSkillInvocableInput): Promise<SkillMutationOutcome>
  listMcpServers(): Promise<McpSnapshot>
  saveMcpServers(servers: McpServerDefinition[]): Promise<McpSaveOutcome>
}

/** Root helper: expand `~`, resolve against cwd, require a directory. */
function resolveRoot(raw: string): string {
  const expanded = raw.startsWith('~/') || raw === '~'
    ? path.join(os.homedir(), raw.slice(1))
    : raw
  return path.resolve(expanded)
}

/** Default managed skill root: the agent-ecosystem user root the user chose. */
function defaultSkillRoots(): string[] {
  const agentsHome = process.env.DSH_AGENTS_HOME ?? path.join(os.homedir(), '.agents')
  return [path.join(agentsHome, 'skills')]
}

function readTextSafe(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return undefined
    throw error
  }
}

/** Atomic write preserving the target's existing mode (defaults to 0o600). */
function writeAtomic(target: string, content: string): void {
  const dir = path.dirname(target)
  mkdirSync(dir, { recursive: true })
  const mode = (() => {
    try {
      return statSync(target).mode & 0o777
    } catch {
      return 0o600
    }
  })()
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.tmp`)
  writeFileSync(tmp, content, { mode, encoding: 'utf8' })
  renameSync(tmp, target)
}

/** Assert a resolved bundle target stays exactly at `<root>/<name>/SKILL.md`. */
function isWithinRoot(root: string, target: string, name: string): boolean {
  const relDir = path.relative(root, path.dirname(target))
  return relDir === name && !relDir.startsWith('..') && !path.isAbsolute(relDir)
}

export function apply(ctx: Context, config: Config) {
  const skillRoots = (config.skillRoots.length > 0 ? config.skillRoots : defaultSkillRoots())
    .map(resolveRoot)
  const patchTarget = config.mcpPatchTarget.trim() !== ''
    ? path.resolve(config.mcpPatchTarget)
    : path.join(resolveDshHome(), 'cordis.patch.yml')

  const scope = ctx.settings.register(NAMESPACE, sectionSchema)

  /** Locate one skill file under the managed roots; returns path + kind. */
  const locateSkill = (
    name: string,
  ): { path: string; flat: boolean } | null => {
    for (const root of skillRoots) {
      const bundle = path.join(root, name, SKILL_FILE)
      if (readTextSafe(bundle) !== undefined) return { path: bundle, flat: false }
      const flat = path.join(root, `${name}${FLAT_SKILL_EXT}`)
      if (readTextSafe(flat) !== undefined) return { path: flat, flat: true }
    }
    return null
  }

  /** One reconcile: plan (settings → patch file) and write it when it drifts. */
  let reconciling: Promise<{ changed: boolean }> | null = null
  const reconcile = (): Promise<{ changed: boolean }> => {
    if (reconciling !== null) return reconciling
    reconciling = (async () => {
      const managed = scope.get().mcpServers
      const existing = readTextSafe(patchTarget)
      const plan = planPatch(existing, managed)
      if (plan.changed) {
        writeAtomic(patchTarget, plan.content)
        ctx.logger.info(
          '[skill-mcp-manager] rewrote %s (%s)', patchTarget, plan.reason,
        )
      }
      return { changed: plan.changed }
    })().finally(() => {
      reconciling = null
    })
    return reconciling
  }

  // Any settings change to `mcpServers` (this plugin's card, or the generic
  // raw-JSON plugins card) reconciles the patch layer, keeping the two views
  // of the truth in lockstep. The explicit call in saveMcpServers below only
  // adds a definitive return value; the mutex makes them safe together.
  scope.watch(() => {
    void reconcile().catch(error => {
      ctx.logger.warn('[skill-mcp-manager] failed to reconcile MCP patch layer: %s', String(error))
    })
  })

  const livePhase = (entry: LoaderEntryLike): McpServerPhase => {
    if (entry.fiber?.state === FIBER_ACTIVE) return 'active'
    if (entry.fiber?.state === FIBER_FAILED) return 'failed'
    if (entry.fiber?.state === FIBER_PENDING || entry.fiber?.state === FIBER_LOADING) return 'pending'
    return 'unknown'
  }

  const collectLive = (): LiveMcpServer[] => {
    const loader = ctx.get('loader') as LoaderLike | undefined
    if (loader === undefined) return []
    const out: LiveMcpServer[] = []
    for (const entry of loader.entries()) {
      if (typeof entry.options.name !== 'string' || entry.options.name !== MCP_CLIENT_NAME) continue
      const serverName = typeof entry.options.config?.serverName === 'string'
        ? entry.options.config.serverName
        : 'unknown'
      const id = typeof entry.options.id === 'string' ? entry.options.id : serverName
      out.push({
        id,
        serverName,
        phase: livePhase(entry),
        managed: id.startsWith(MANAGER_ID_PREFIX),
        present: true,
      })
    }
    return out
  }

  let bridgeProbeCache: boolean | null = null
  const bridgeResolvable = async (): Promise<boolean> => {
    if (bridgeProbeCache !== null) return bridgeProbeCache
    try {
      await import('@deepseek-ai/dsh-mcp-client')
      bridgeProbeCache = true
    } catch {
      bridgeProbeCache = false
    }
    return bridgeProbeCache
  }

  const receiver: SkillMcpManagerReceiver = {
    typertRemote: undefined as unknown as TypertGatewayBinding<SkillMcpManagerReceiver>,

    async listSkills(): Promise<SkillsSnapshot> {
      const roots: SkillRootInfo[] = []
      const skills: SkillView[] = []
      const errors: string[] = []
      skillRoots.forEach(root => {
        const label = path.basename(root) || 'skills'
        roots.push({ name: label, path: root })
        let entries: string[]
        try {
          entries = readdirSync(root, { withFileTypes: true }).map(entry => entry.name)
        } catch (error) {
          if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return // empty root = valid state
          errors.push(`${root}: ${error instanceof Error ? error.message : String(error)}`)
          return
        }
        for (const entryName of entries.sort()) {
          try {
            const bundleDir = path.join(root, entryName)
            const bundleFile = path.join(bundleDir, SKILL_FILE)
            let file = bundleFile
            let kind: 'bundle' | 'flat' = 'bundle'
            if (readTextSafe(bundleFile) === undefined) {
              if (!entryName.endsWith(FLAT_SKILL_EXT)) continue
              file = bundleDir // flat file path == <root>/<name>.md
              kind = 'flat'
            }
            const text = readTextSafe(file)
            if (text === undefined) continue
            const { data } = parseSkillDoc(text)
            const name = typeof data.name === 'string' && data.name !== ''
              ? data.name
              : kind === 'flat' ? entryName.slice(0, -FLAT_SKILL_EXT.length) : entryName
            const description = typeof data.description === 'string' ? data.description : ''
            const invocation = invocationOf(data)
            skills.push({
              name,
              description,
              root,
              rootLabel: label,
              kind,
              path: file,
              modelInvocable: invocation.modelInvocable,
              userInvocable: invocation.userInvocable,
            })
          } catch (error) {
            errors.push(`${entryName}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      })
      return { roots, skills, errors }
    },

    async addSkill(input: AddSkillInput): Promise<SkillMutationOutcome> {
      const name = input.name.trim()
      if (!isValidSkillName(name)) {
        return { ok: false, error: `skill name "${name}" must be kebab-case (lowercase letters, digits and hyphens)` }
      }
      if (input.description.trim() === '' && input.body.trim() === '' && input.sourceFile === undefined) {
        return { ok: false, error: 'give the skill a description, some body text, or an uploaded markdown file' }
      }
      if (input.sourceFile !== undefined) {
        if (input.sourceFile.content.length > MAX_UPLOAD_BYTES) {
          return { ok: false, error: `the uploaded file is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB)` }
        }
      }
      const exist = locateSkill(name)
      if (exist !== null) {
        return { ok: false, error: `a skill named "${name}" already exists at ${exist.path}` }
      }
      const root = skillRoots[0]
      if (root === undefined) return { ok: false, error: 'no skill root is configured' }
      const target = path.join(root, name, SKILL_FILE)
      if (!isWithinRoot(root, target, name)) {
        return { ok: false, error: 'the skill name resolves outside the managed root' }
      }
      const flatCollision = path.join(root, `${name}${FLAT_SKILL_EXT}`)
      if (readTextSafe(flatCollision) !== undefined) {
        return { ok: false, error: `a flat skill "${name}" already exists; edit it instead` }
      }
      try {
        mkdirSync(path.dirname(target), { recursive: true })
        const description = input.description.trim()
        const safeWhenToUse = input.whenToUse !== undefined && input.whenToUse !== '' ? input.whenToUse : undefined
        let content: string
        if (input.sourceFile !== undefined) {
          // Uploaded file: keep its body verbatim and preserve its frontmatter
          // keys; the form's name/description (and whenToUse, when provided)
          // take precedence, and its own invocation flags stay in effect.
          const { data, body } = parseSkillDoc(input.sourceFile.content)
          const extra: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(data)) {
            if (key === 'name' || key === 'description' || key === 'whenToUse'
              || key === 'disable-model-invocation' || key === 'user-invocable') continue
            extra[key] = value
          }
          const invocation = invocationOf(data)
          const fileWhenToUse = typeof data.whenToUse === 'string' && data.whenToUse !== '' ? data.whenToUse : undefined
          const whenToUse = safeWhenToUse !== undefined ? safeWhenToUse : fileWhenToUse
          content = buildSkillDocFromParts({
            name,
            description: description !== '' ? description : (typeof data.description === 'string' ? data.description : ''),
            body,
            ...(whenToUse === undefined ? {} : { whenToUse }),
            modelInvocable: invocation.modelInvocable,
            userInvocable: invocation.userInvocable,
            extra,
          })
        } else {
          content = buildSkillDoc({
            name,
            description,
            body: input.body,
            ...(safeWhenToUse === undefined ? {} : { whenToUse: safeWhenToUse }),
            modelInvocable: true,
            userInvocable: true,
          })
        }
        writeFileSync(target, content, { encoding: 'utf8', mode: 0o600 })
      } catch (error) {
        return { ok: false, error: `failed to write ${target}: ${error instanceof Error ? error.message : String(error)}` }
      }
      return { ok: true, path: target }
    },

    async setSkillInvocable(input: SetSkillInvocableInput): Promise<SkillMutationOutcome> {
      const found = locateSkill(input.name)
      if (found === null) {
        return { ok: false, error: `no skill named "${input.name}" under the managed roots` }
      }
      const current = readTextSafe(found.path)
      if (current === undefined) {
        return { ok: false, error: `could not read ${found.path}` }
      }
      const next = setSkillInvocation(current, {
        modelInvocable: input.modelInvocable,
        userInvocable: input.userInvocable,
      })
      try {
        writeFileSync(found.path, next, { encoding: 'utf8' })
      } catch (error) {
        return { ok: false, error: `failed to update ${found.path}: ${error instanceof Error ? error.message : String(error)}` }
      }
      return { ok: true, path: found.path }
    },

    async listMcpServers(): Promise<McpSnapshot> {
      const servers = scope.get().mcpServers
      const live = collectLive()
      for (const server of servers) {
        if (!live.some(entry => entry.id === server.id)) {
          live.push({ id: server.id, serverName: server.serverName, phase: 'unknown', managed: true, present: false })
        }
      }
      const warnings: string[] = []
      for (const entry of live) {
        if (entry.managed || entry.serverName === 'unknown') continue
        const clash = servers.find(server => server.serverName === entry.serverName)
        if (clash !== undefined) {
          warnings.push(
            `serverName "${entry.serverName}" is also configured outside the manager (${entry.id}) — one instance will fail to load`,
          )
        }
      }
      return {
        servers,
        live,
        bridgeResolvable: await bridgeResolvable(),
        patchPath: patchTarget,
        warnings,
      }
    },

    async saveMcpServers(servers: McpServerDefinition[]): Promise<McpSaveOutcome> {
      const error = validateServerSet(servers)
      if (error !== null) return { ok: false, error }
      // Normalize ids to the manager's canonical row ids.
      const normalized = servers.map(server => ({ ...server, id: rowIdFor(server.serverName) }))
      try {
        await scope.update({ mcpServers: normalized })
      } catch (writeError) {
        return { ok: false, error: `failed to persist settings: ${writeError instanceof Error ? writeError.message : String(writeError)}` }
      }
      const now = scope.get().mcpServers
      const landed = JSON.stringify(now) === JSON.stringify(normalized)
      if (!landed) {
        return {
          ok: false,
          error: 'the settings write did not take effect (read-only document or a concurrent change); the running configuration was not changed',
        }
      }
      // `applied` means "the patch layer is now in sync with the saved set":
      // either this reconcile or the settings-watcher's own reconcile wrote it,
      // so the honest signal is the post-condition, not who won the write race.
      await reconcile()
      const applied = planPatch(readTextSafe(patchTarget), normalized).reason === 'in-sync'
      return { ok: true, saved: true, applied, patchPath: patchTarget }
    },
  }
  receiver.typertRemote = bindTypertRemote(receiver, SERVICE, { namespace: SERVICE })
  // A plain provided object resolves through the gateway's receiver lookup
  // (`receiverContext.get(service)`); the binding only needs to be consistent.
  ctx.provide(SERVICE, receiver)

  // Register the endpoints so the gateway claims `/api/skillMcpManager/<method>`.
  const contribution: TypertContribution = {
    package: 'dsh-skill-mcp-manager',
    face: 'host',
    schemas: [],
    model: EMPTY_MODEL,
    invocations: [...DESCRIPTORS],
  }
  ctx.typert.register(contribution)

  // Initial reconcile: brings any pre-existing managed rows in sync with
  // settings, and no-ops when both are empty (the file is never rewritten
  // just for a startup touch).
  void reconcile().catch(error => {
    ctx.logger.warn('[skill-mcp-manager] initial MCP patch reconcile failed: %s', String(error))
  })
}
