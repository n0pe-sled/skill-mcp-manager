import assert from 'node:assert/strict'
import { childrenFromProfiles, isDockerGateway, publicToolName, discoverDockerChildren } from '../src/mcp-discovery.ts'
const profiles = [{ id: 'selected', servers: [
  { env: { SECRET: 'never expose' }, snapshot: { server: { name: 'brave', description: 'Search', tools: [{ name: 'search' }, { name: 'missing' }] } } },
  { snapshot: { server: { name: 'kubernetes', tools: [{ name: 'pods' }] } } },
] }, { id: 'other', servers: [{ snapshot: { server: { name: 'wrong-profile' } } }] }]
assert.equal(isDockerGateway({ command: '/usr/local/bin/docker', args: ['mcp', 'gateway', 'run', '--profile=selected'] }), true)
assert.equal(isDockerGateway({ command: 'echo', args: ['mcp', 'gateway', 'run'] }), false)
const children = childrenFromProfiles(profiles, 'selected', 'docker', ['mcp__docker__search'])
assert.deepEqual(children.map(c => c.name), ['brave', 'kubernetes'])
assert.deepEqual(children[0].availableTools, ['search'])
assert.deepEqual(children[1].availableTools, [])
assert.ok(!JSON.stringify(children).includes('SECRET'))
assert.throws(() => childrenFromProfiles({}, 'selected', 'docker', []))
assert.throws(() => childrenFromProfiles(profiles, 'missing', 'docker', []))
assert.equal(publicToolName('docker', 'x'.repeat(100)).length, 64)
assert.notEqual(publicToolName('docker', 'a.b'), publicToolName('docker', 'a/b'))
const warnings = []
assert.deepEqual(await discoverDockerChildren({ command: '/missing/docker', args: ['mcp', 'gateway', 'run', '--profile=selected'] }, 'docker', [], warnings), [])
assert.equal(warnings.length, 1)
console.log('Docker discovery tests passed')
