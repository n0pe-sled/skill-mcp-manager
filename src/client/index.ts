/**
 * Browser half of the Skill & MCP Manager: registers the Settings page
 * (`settings.section` slot) hosting the Skills + MCP Servers tabs, and mounts
 * the `skillMcpManager` Remote so the panel can talk to the host half.
 *
 * Every read/write flows through the injected RPC callbacks; the component
 * never sees `ctx`. The mount is lazy and contained: a mount failure only
 * disables the panel's actions, never the Settings page.
 *
 * Export discipline (packages/client/AGENTS.md): the ./client entry exports
 * only `apply`/`inject` and shared types; the component stays internal.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls in the settings.section slot declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: ctx.slots and the SlotMap types.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { SkillMcpManagerPanel } from './SkillMcpManagerPanel.tsx'
import type { SkillMcpManagerInjected } from './SkillMcpManagerPanel.tsx'
import { DESCRIPTORS, SERVICE } from '../shared/remote.ts'
import type {
  AddSkillInput, McpSaveOutcome, McpServerDefinition, McpSnapshot,
  RemoteCallOutcome, SetSkillInvocableInput, SkillMutationOutcome, SkillsSnapshot,
  SkillUploadPreview, SourceMarkdownFile,
} from '../shared/remote.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The mounted skillMcpManager namespace, resolved through the service store. */
interface SkillMcpManagerNamespace {
  listSkills(): Promise<RemoteResult<SkillsSnapshot>>
  addSkill(input: AddSkillInput): Promise<RemoteResult<SkillMutationOutcome>>
  previewSkillUpload(source: SourceMarkdownFile): Promise<RemoteResult<SkillUploadPreview>>
  setSkillInvocable(input: SetSkillInvocableInput): Promise<RemoteResult<SkillMutationOutcome>>
  listMcpServers(): Promise<RemoteResult<McpSnapshot>>
  saveMcpServers(servers: McpServerDefinition[]): Promise<RemoteResult<McpSaveOutcome>>
}

export type {
  SkillMcpManagerInjected,
  SkillMcpManagerOutcome,
} from './SkillMcpManagerPanel.tsx'
export type {
  RemoteCallOutcome, AddSkillInput, SkillMutationOutcome, SkillsSnapshot, SkillView,
  McpServerDefinition, McpSaveOutcome, McpSnapshot, LiveMcpServer, McpServerPhase,
  SkillUploadPreview, SourceMarkdownFile,
} from '../shared/remote.ts'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'remote']

/**
 * Register the Settings section for the skill & MCP manager.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Mount the Remote for this plugin's fiber. Not awaited: a mount failure must
  // only disable the panel's actions. Every callback awaits the same promise so
  // the contained rejection is still reported there.
  const mount = ctx.remote.$mount({
    package: 'dsh-skill-mcp-manager',
    descriptors: [...DESCRIPTORS],
  })
  mount.catch(() => {})

  /** Call one Remote method, surfacing mount/transport failures as outcomes. */
  const call = async <A extends unknown[], R>(
    method: (namespace: SkillMcpManagerNamespace) => (...args: A) => Promise<RemoteResult<R>>,
    ...args: A
  ): Promise<RemoteCallOutcome<R>> => {
    try {
      await mount
      const namespace = ctx.get(`remote.${SERVICE}`) as SkillMcpManagerNamespace | undefined
      if (namespace === undefined) {
        return { ok: false, error: 'Skill & MCP Manager is unavailable — the remote is not mounted.' }
      }
      const result = await method(namespace)(...args)
      if (result.ok) return { ok: true, value: result.value }
      return { ok: false, error: `${result.error.message} (${result.error.code})` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const injected: SkillMcpManagerInjected = {
    listSkills: () => call(ns => ns.listSkills.bind(ns)),
    addSkill: input => call(ns => ns.addSkill.bind(ns), input),
    previewSkillUpload: source => call(ns => ns.previewSkillUpload.bind(ns), source),
    setSkillInvocable: input => call(ns => ns.setSkillInvocable.bind(ns), input),
    listMcpServers: () => call(ns => ns.listMcpServers.bind(ns)),
    saveMcpServers: servers => call(ns => ns.saveMcpServers.bind(ns), servers),
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skill-mcp-manager',
    order: 300,
    label: 'Skills & MCP',
    inject: () => ({ ...injected }),
  }, SkillMcpManagerPanel))
}
