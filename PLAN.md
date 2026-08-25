# Plan → Outcome: dsh-skill-mcp-manager

## 1. Objective

A dual-half plugin (`dsh-skill-mcp-manager`) adding a **"Skills & MCP"**
Settings section to the DSH web GUI: manage skills (list / add / toggle
visibility, disable-only removal per scope decision) and MCP servers (list with
live status / add / remove), with adds and removes going live without a GUI
restart.

## 2. Decisions (confirmed with the user)

- MCP rows are written to **`$DSH_HOME/cordis.patch.yml`** (machine-global user
  patch layer, already HMR-watched by `profile-boot`).
- New skills are created in **`~/.agents/skills`** (existing user-skill home);
  `.skill-lock.json` is never touched.
- Skill removal = **disable via frontmatter**, not file deletion.

## 3. Architecture

- **Skills**: disk-driven. Scan the managed root one level deep (bundle dirs +
  flat `.md`), parse the standard frontmatter, add via `SKILL.md` creation,
  toggle via frontmatter rewrite of `disable-model-invocation` /
  `user-invocable`. `dsh-skill-filesystem` (mounted per agent preset on web)
  already watches these roots, so changes reach model catalogs automatically.
- **MCP**: settings namespace `skill-mcp-manager.mcpServers` is the durable
  truth. A reconcile step (on settings change + at apply) projects the set into
  `$DSH_HOME/cordis.patch.yml` as `@deepseek-ai/dsh-mcp-client` insert rows —
  preserving every non-managed row and `!!js` scalars via the same js-yaml
  dialect (`JSON_SCHEMA.extend` + `JsExpr`) the loader include uses, and never
  rewriting a file already in sync. `profile-boot`'s `watchUserPatches` HMR
  watcher hot-applies the file, so instances are added/removed live.
- **RPC**: one Typert endpoint `skillMcpManager` with five methods
  (`listSkills`, `addSkill`, `setSkillInvocable`, `listMcpServers`,
  `saveMcpServers`), shared strict-codec descriptor contract in
  `src/shared/remote.ts`; browser panel never sees `ctx`.
- **Live status**: `ctx.loader` entries filtered to `@deepseek-ai/dsh-mcp-client`
  (active/pending/failed/unknown), including externally-added rows.

## 4. Files

```
src/index.ts                     host half (settings ns, reconcile, RPC receiver)
src/client/index.ts              browser half (slot registration + remote mount)
src/client/SkillMcpManagerPanel.tsx   the two-tab Settings section
src/shared/remote.ts             wire contract: types, strict validators, descriptors
src/skill-fmt.ts                 SKILL.md frontmatter build/parse/mutate
src/mcp-config.ts                patch dialect, ownership, planPatch, validation
tests/smoke.mjs                  host smoke tests (stubbed ctx, temp dirs)
cordis.patch.yml / package.json / tsdown.config.ts / tsconfig.json
```

## 5. Verification performed

- `tsc --noEmit` clean; `tsdown` builds both halves (`lib/index.js` ESM +
  `lib/client.js` factory).
- `node tests/smoke.mjs` — 8 checks: module contract, helpers, apply wiring,
  skill add/list/conflict/toggle, patch write preserving unrelated rows + `!!js`,
  idempotence (zero churn), flat-layout, frontmatter round-trip.
- **Second-instance integration** (temp `DSH_HOME`, real `dsh profile <it>` on
  :3081):
  - plugin entry present in the loader tree; browser boot manifest includes
    `dsh-skill-mcp-manager` and its client bundle serves 200;
  - initial reconcile wrote the manager-format row to the home patch and the
    real loader mounted `@deepseek-ai/dsh-mcp-client`, a fixture stdio MCP
    server handshook (`initialize` → `tools-list`);
  - **live add**: rewriting the home patch to add a second managed row mounted
    it and its fixture handshook — zero restart;
  - **live remove**: dropping the row disposed the instance (2 → 1 fixture
    processes), demo untouched;
  - a hand-maintained duplicate row in a second patch layer correctly failed
    the transactional reload (surface "collision" warning), confirming the
    manager never fights how it owns rows.

## 6. Key learnings / risks encoded in the design

- The web surface disables the shared HMR row; `profile-boot` mounts a
  watch-only HMR config watcher, so `cordis.patch.yml` edits stay live — this
  is what makes GUI saves hot.
- A row colliding across two patch layers makes include reloads roll back (kept
  as an explicitly surfaced warning case, never silently clobbered).
- The patch file is rewritten only on real drift (comments preserved until then);
  when rewritten, leading comments are regenerated.

## 7. Follow-ups (out of scope)

- Hard deletion of skill files; editing bodies in place; per-skill metadata edits.
- Importing skills from git/bundles; reconciling `~/.agents/.skill-lock.json`.
- Non-stdio MCP variants beyond streamable-http; encrypted secret storage.
- Showing project/system skill roots not under the managed root.
