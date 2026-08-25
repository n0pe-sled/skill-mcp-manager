/**
 * Host-half smoke test for dsh-skill-mcp-manager, run without the harness.
 *
 * Exercises the plugin against a stubbed Cordis context and temp dirs (never
 * the real $DSH_HOME):
 *   - Config schema / name / inject contract;
 *   - pure helpers (planPatch, validateServerSet, skill frontmatter);
 *   - apply() wiring: receiver registration, settings scope, typert contribution;
 *   - RPC flows: addSkill writes a valid SKILL.md bundle, setSkillInvocable
 *     rewrites frontmatter, saveMcpServers persists settings + rewrites the
 *     target patch file while preserving unrelated rows and `!!js` scalars.
 *
 * Run with: node tests/smoke.mjs
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const plugin = await import('../lib/index.js')

/** Tiny settings-scope stand-in backed by an in-memory object. */
function makeScope(initial) {
  let value = initial
  const watchers = new Set()
  return {
    get: () => value,
    watch: (cb) => {
      watchers.add(cb)
      return () => watchers.delete(cb)
    },
    update: async (patch) => {
      value = { ...value, ...patch }
      for (const cb of watchers) {
        try { await cb(value, value) } catch { /* contained like the service */ }
      }
    },
    replace: async (section) => {
      value = { ...value, ...section }
      for (const cb of watchers) {
        try { await cb(value, value) } catch { /* contained */ }
      }
    },
  }
}

/** Stub Cordis context: records provisions, contributions, and a fake scope. */
function makeCtx() {
  const scope = makeScope({ mcpServers: [] })
  const provided = {}
  const contributions = []
  const events = new Map()
  return {
    scope,
    provided,
    contributions,
    events,
    ctx: {
      settings: { register: () => scope },
      typert: { register: (contribution) => contributions.push(contribution) },
      provide: (key, value) => { provided[key] = value },
      get: () => undefined,
      on: (event, handler) => events.set(event, handler),
      logger: { info: () => {}, warn: () => {} },
    },
  }
}

const dir = mkdtempSync(join(tmpdir(), 'dsh-skill-mcp-manager-smoke-'))
const skillRoot = join(dir, 'agents', 'skills')
const patchFile = join(dir, 'cordis.patch.yml')
const unrelatedRow = [
  '- id: web-search-deepseek',
  "  name: '@deepseek-ai/dsh-web-search-deepseek'",
  '  disabled: true',
  '',
  '- id: sample',
  '  name: some-plugin',
  '  config:',
  '    token: !!js "process.env.X_TOKEN"',
].join('\n')

const serverDef = (overrides = {}) => ({
  id: 'dsh-mcp-manager-github',
  serverName: 'github',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'abc' },
  cwd: '',
  url: '',
  headers: {},
  toolCallTimeoutMs: 60000,
  failOnStartupError: false,
  ...overrides,
})

let pass = 0
function ok(name) {
  pass += 1
  console.log(`  ✔ ${name}`)
}

console.log('dsh-skill-mcp-manager smoke:')
try {
  // 1. Module contract -----------------------------------------------------
  assert.equal(typeof plugin.Config, 'function', 'Config is a schema function')
  assert.equal(plugin.name, 'skill-mcp-manager', 'name export')
  assert.deepEqual(plugin.inject.sort(), ['settings', 'typert'].sort(), 'inject list')
  ok('module contract (name/inject/Config)')

  // 2. Pure helpers --------------------------------------------------------
  const { planPatch, validateServerSet } = plugin
  assert.equal(validateServerSet([]), null, 'empty set valid')
  assert.ok(validateServerSet([serverDef(), serverDef({ serverName: 'github' })]).includes('duplicated'),
    'duplicate serverName rejected')
  assert.ok(validateServerSet([serverDef({ serverName: 'bad name' })]).includes('must match'),
    'invalid serverName rejected')
  assert.ok(validateServerSet([serverDef({ transport: 'streamable-http', url: 'nope' })]).includes('invalid url'),
    'invalid http url rejected')
  const firstPlan = planPatch(undefined, [])
  assert.equal(firstPlan.changed, false, 'empty plan is a no-op')
  assert.equal(firstPlan.reason, 'in-sync', 'empty plan reason')
  ok('pure helpers: validateServerSet + planPatch empty no-op')

  // 3. apply() wiring ------------------------------------------------------
  const { ctx, scope, provided, contributions } = makeCtx()
  const config = plugin.Config({ skillRoots: [skillRoot], mcpPatchTarget: patchFile })
  plugin.apply(ctx, config)
  assert.ok(provided.skillMcpManager, 'receiver provided under skillMcpManager')
  assert.equal(contributions.length, 1, 'one typert contribution registered')
  assert.equal(contributions[0].package, 'dsh-skill-mcp-manager', 'contribution package')
  assert.ok(contributions[0].invocations.length >= 5, 'all five invocations registered')
  ok('apply wiring: receiver + typert contribution')

  // 4. Skills flow ---------------------------------------------------------
  const manager = provided.skillMcpManager
  const added = await manager.addSkill({
    name: 'demo-skill',
    description: 'A smoke-test skill.',
    body: '## Steps\n\nDo the thing.\n',
  })
  assert.equal(added.ok, true, 'addSkill ok')
  assert.ok(existsSync(added.path), 'bundle file written')
  const written = readFileSync(added.path, 'utf8')
  assert.ok(written.startsWith('---\n'), 'written doc has frontmatter')
  assert.ok(written.includes('name: demo-skill'), 'frontmatter name')
  assert.ok(written.includes('description: A smoke-test skill.'), 'frontmatter description')

  const snapshot = await manager.listSkills()
  assert.equal(snapshot.skills.length, 1, 'one skill listed')
  assert.equal(snapshot.skills[0].name, 'demo-skill', 'listed name')
  assert.equal(snapshot.skills[0].modelInvocable, true, 'default model invocable')

  const conflict = await manager.addSkill({ name: 'demo-skill', description: 'x', body: 'y' })
  assert.equal(conflict.ok, false, 'duplicate add rejected')

  const toggled = await manager.setSkillInvocable({ name: 'demo-skill', modelInvocable: false, userInvocable: false })
  assert.equal(toggled.ok, true, 'visibility toggle ok')
  const toggledText = readFileSync(added.path, 'utf8')
  assert.ok(toggledText.includes('disable-model-invocation: true'), 'model suppressed in frontmatter')
  assert.ok(toggledText.includes('user-invocable: false'), 'user suppressed in frontmatter')
  assert.ok(toggledText.includes('Do the thing.'), 'body preserved after toggle')
  ok('skills flow: add / list / conflict / toggle')

  // 4b. Skills flow — upload preview pre-fills every field
  const preview = await manager.previewSkillUpload({
    name: 'original.md',
    content: [
      '---',
      'name: Original Name',                    // non-kebab: must be slugged
      'description: A derived description.',
      'whenToUse: On uploads.',
      'user-invocable: false',
      '---',
      '',
      '# Original Title',
      '',
      'Body line.',
    ].join('\n'),
  })
  assert.equal(preview.name, 'original-name', 'preview slugs a non-kebab frontmatter name')
  assert.equal(preview.description, 'A derived description.', 'preview description from frontmatter')
  assert.equal(preview.whenToUse, 'On uploads.', 'preview whenToUse from frontmatter')
  assert.equal(preview.modelInvocable, true, 'preview model visible by default')
  assert.equal(preview.userInvocable, false, 'preview user suppressed per file flag')
  const previewH1 = await manager.previewSkillUpload({
    name: 'My Skill.md',
    content: '# Best Skill Ever\n\nJust a title.\n',
  })
  assert.equal(previewH1.name, 'best-skill-ever', 'preview falls back to slugified H1')
  ok('skills flow: previewSkillUpload derives name/description/whenToUse/visibility')

  // 4c. Skills flow — upload .md source file (form fields win; file kept)
  const uploadedSource = [
    '---',
    'name: original-name',
    'description: File description.',
    'whenToUse: Use on Tuesdays.',
    'disable-model-invocation: true',
    'metadata:',
    '  author: me',
    'customKey: kept',
    '---',
    '',
    '## From the file',
    '',
    'Uploaded body line.',
  ].join('\n')
  const uploaded = await manager.addSkill({
    name: 'uploaded-skill',
    description: 'Form description (wins).',
    body: '',
    modelInvocable: false,
    sourceFile: { name: 'original.md', content: uploadedSource },
  })
  assert.equal(uploaded.ok, true, 'upload add ok')
  assert.ok(existsSync(uploaded.path), 'uploaded bundle file written')
  const uploadedText = readFileSync(uploaded.path, 'utf8')
  assert.ok(uploadedText.includes('name: uploaded-skill'), 'form name wins over file frontmatter name')
  assert.ok(uploadedText.includes('description: Form description (wins).'), 'form description wins over file frontmatter')
  assert.ok(uploadedText.includes('whenToUse: Use on Tuesdays.'), 'file whenToUse preserved')
  assert.ok(uploadedText.includes('disable-model-invocation: true'), 'form invocation flag written')
  assert.ok(uploadedText.includes('author: me'), 'file nested metadata preserved')
  assert.ok(uploadedText.includes('customKey: kept'), 'file custom key preserved')
  assert.ok(uploadedText.includes('Uploaded body line.'), 'file body kept verbatim')
  assert.ok(!uploadedText.includes('name: original-name'), 'file frontmatter name not leaked')
  const uploadedSnapshot = await manager.listSkills()
  const uploadedView = uploadedSnapshot.skills.find(skill => skill.name === 'uploaded-skill')
  assert.equal(uploadedView?.modelInvocable, false, 'uploaded skill model suppressed per form flag')
  ok('skills flow: upload .md source (frontmatter + body preserved)')

  // 4d. Skills flow — no name typed: host derives it from the file
  const derived = await manager.addSkill({
    name: '',
    description: '',
    body: '',
    sourceFile: { name: 'trainer.md', content: '---\ndescription: Train me.\n---\n\n# Skill Trainer\n\nBody.\n' },
  })
  assert.equal(derived.ok, true, 'named-by-file add ok')
  assert.ok(derived.path.endsWith('/skill-trainer/SKILL.md'), 'name derived from H1: ' + derived.path)
  const derivedText = readFileSync(derived.path, 'utf8')
  assert.ok(derivedText.includes('name: skill-trainer'), 'derived frontmatter name')
  assert.ok(derivedText.includes('description: Train me.'), 'derived description from file')
  ok('skills flow: addSkill derives name from file when none typed')

  // 4e. Skills flow — upload oversized file rejected
  const tooBig = await manager.addSkill({
    name: 'too-big-skill',
    description: 'x',
    body: '',
    sourceFile: { name: 'big.md', content: 'a'.repeat(1024 * 1024 + 1) },
  })
  assert.equal(tooBig.ok, false, 'oversized upload rejected')
  assert.ok(!existsSync(join(skillRoot, 'too-big-skill')), 'no file written for rejected upload')
  ok('skills flow: oversized upload rejected')

  // 5. MCP flow ------------------------------------------------------------
  writeFileSync(patchFile, unrelatedRow, { encoding: 'utf8' })
  const saved = await manager.saveMcpServers([serverDef()])
  assert.equal(saved.ok, true, 'saveMcpServers ok')
  assert.equal(saved.saved, true, 'settings persisted')
  assert.equal(saved.applied, true, 'patch rewritten')
  assert.equal(scope.get().mcpServers.length, 1, 'settings holds one server')

  const patched = readFileSync(patchFile, 'utf8')
  assert.ok(patched.includes("name: '@deepseek-ai/dsh-mcp-client'"), 'mcp client row written')
  assert.ok(patched.includes('serverName: github'), 'serverName written')
  assert.ok(patched.includes('disabled: true'), 'unrelated row preserved')
  assert.ok(patched.includes('process.env.X_TOKEN'), '!!js scalar round-tripped')
  ok('mcp flow: save writes patch, preserves unrelated rows + !!js')

  const idempotentBytes = readFileSync(patchFile, 'utf8')
  const idempotent = await manager.saveMcpServers([serverDef()])
  assert.equal(idempotent.applied, true, 'identical re-save reports the layer in sync')
  assert.equal(readFileSync(patchFile, 'utf8'), idempotentBytes, 'identical re-save produces zero file churn')

  const mcpSnapshot = await manager.listMcpServers()
  assert.equal(mcpSnapshot.servers.length, 1, 'snapshot lists managed server')
  assert.equal(mcpSnapshot.bridgeResolvable, true, 'bridge resolves (devDep present)')

  const removed = await manager.saveMcpServers([])
  assert.equal(removed.ok, true, 'empty save ok')
  const afterRemove = readFileSync(patchFile, 'utf8')
  assert.ok(!afterRemove.includes("name: '@deepseek-ai/dsh-mcp-client'"), 'managed row removed')
  assert.ok(afterRemove.includes('disabled: true'), 'unrelated row still preserved')
  ok('mcp flow: idempotence + removal preserves unrelated rows')

  // 6. Skill root layout sanity ---------------------------------------------
  const entries = readdirSync(skillRoot)
  assert.deepEqual(entries.sort(), ['demo-skill', 'skill-trainer', 'uploaded-skill'].sort(), 'bundle dir layout')
  assert.equal(existsSync(join(skillRoot, 'demo-skill', 'SKILL.md')), true, 'SKILL.md exists')
  ok('skill root layout')

  // 7. Frontmatter helper exports -------------------------------------------
  const rebuilt = plugin.buildSkillDoc({ name: 'x', description: 'd', body: 'b', modelInvocable: false, userInvocable: true })
  assert.ok(rebuilt.includes('disable-model-invocation: true'), 'buildSkillDoc suppression')
  const parsed = plugin.parseSkillDoc(rebuilt)
  assert.equal(parsed.data.name, 'x', 'parseSkillDoc name')
  assert.equal(parsed.body, 'b\n', 'parseSkillDoc body')
  ok('frontmatter helper exports')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${pass} checks passed.`)
