import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import path from 'node:path'
import type { McpChildServer } from './shared/remote.ts'

const run = promisify(execFile)
interface GatewayConfig { command?: string; args?: string[]; env?: Record<string, string>; cwd?: string }

export function isDockerGateway(config?: GatewayConfig): boolean {
  return path.basename(config?.command ?? '') === 'docker'
    && config?.args?.slice(0, 3).join(' ') === 'mcp gateway run'
}

function option(args: string[], name: string): string | undefined {
  const inline = args.find(arg => arg.startsWith(`${name}=`))
  if (inline !== undefined) return inline.slice(name.length + 1)
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}

// Same public identity as the pinned harness MCP bridge, including lossy names.
export function publicToolName(server: string, raw: string): string {
  const joined = `mcp__${server}__${raw}`
  const normalized = joined.replace(/[^A-Za-z0-9_-]/g, '_')
  if (joined === normalized && joined.length <= 64) return joined
  const hash = createHash('sha256').update(`${server}\0${raw}`).digest('hex').slice(0, 12)
  return `${normalized.slice(0, 51)}_${hash}`
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

/** Project only display fields. Profile config, environment and secrets never leave the host. */
export function childrenFromProfiles(value: unknown, profile: string, namespace: string, liveTools: readonly string[]): McpChildServer[] {
  if (!Array.isArray(value)) throw new Error('Unexpected Docker profile response')
  const selected = value.map(record).find(item => item.id === profile)
  if (!selected || !Array.isArray(selected.servers)) throw new Error('Docker profile was not found')
  const live = new Set(liveTools)
  return selected.servers.map(value => {
    const item = record(value)
    const server = record(record(item.snapshot).server)
    const name = typeof server.name === 'string' ? server.name
      : typeof item.name === 'string' ? item.name : typeof item.image === 'string' ? item.image : 'Unnamed server'
    const tools = Array.isArray(server.tools)
      ? server.tools.map(record).map(tool => tool.name).filter((name): name is string => typeof name === 'string') : []
    return {
      name,
      description: typeof server.description === 'string' ? server.description : '',
      tools,
      availableTools: tools.filter(name => live.has(publicToolName(namespace, name))),
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

/** Read the selected gateway profile without starting another gateway or calling MCP tools. */
export async function discoverDockerChildren(config: GatewayConfig, namespace: string, liveTools: readonly string[], warnings: string[]): Promise<McpChildServer[]> {
  const args = config.args ?? []
  const profile = option(args, '--profile')
  if (!profile) {
    const servers = option(args, '--servers')
    if (servers) return servers.split(',').filter(Boolean).map(name => ({ name, description: '', tools: [], availableTools: [] }))
    warnings.push(`${namespace}: child discovery requires a Docker gateway --profile or --servers selection.`)
    return []
  }
  try {
    const { stdout } = await run(config.command ?? 'docker', [
      'mcp', 'profile', 'server', 'ls', '--filter', `profile=${profile}`, '--format', 'json',
    ], { timeout: 8000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...config.env }, ...(config.cwd ? { cwd: config.cwd } : {}),
    })
    return childrenFromProfiles(JSON.parse(stdout), profile, namespace, liveTools)
  } catch {
    // exec errors can contain profile contents or sensitive stderr; keep diagnostics bounded.
    warnings.push(`${namespace}: could not read Docker profile "${profile}". Check Docker is available, then refresh.`)
    return []
  }
}
