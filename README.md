# dsh-skill-mcp-manager

Manage **skills** and **MCP servers** from the DSH web UI — a dual-half plugin
that adds a "Skills & MCP" section to the Settings page.

- **Skills** tab: list the user's skills, create new `SKILL.md` bundles — by
  typing the instructions or **uploading a `.md` file** — and toggle each
  skill's model / user invocation visibility. New skills are written to
  `~/.agents/skills` (the agent-ecosystem user root), which
  `@deepseek-ai/dsh-skill-filesystem` already watches — a created or toggled
  skill appears in the next catalog observation automatically. Removal is
  *disable-only* in v1 (frontmatter switch), no file deletion.
- **MCP Servers** tab: list configured servers with live connection state, add
  (stdio or streamable-http), and remove. Servers persist to the machine-global
  `~/.dsh/cordis.patch.yml` as `@deepseek-ai/dsh-mcp-client` instances; DSH's
  own user-patch HMR watcher hot-applies the file, so **adds and removes go
  live without restarting the GUI** — verified end-to-end against a real
  harness instance.

## Install

```bash
dsh plugin --profile web add /path/to/dsh-skill-mcp-manager
```

or, file-level (no pnpm needed because the profile's shared module fallback
provides all `@deepseek-ai` runtime deps):

1. Add the bundle to `$DSH_HOME/profiles/web/package.json`:

   ```json
   {
     "dependencies": { "dsh-skill-mcp-manager": "link:/path/to/dsh-skill-mcp-manager" },
     "dsh": { "profile": { "bundles": [ /* ...existing..., "dsh-skill-mcp-manager" ] } }
   }
   ```

2. Symlink it into the profile so the loader resolves it:

   ```bash
   ln -s /path/to/dsh-skill-mcp-manager "$HOME/.dsh/profiles/web/node_modules/dsh-skill-mcp-manager"
   ```

3. Restart the GUI (`dsh web`). The new "Skills & MCP" section appears in
   **Settings**.

## Architecture

```
Browser (Settings page: Skills & MCP)
   │  Typert RPC  (5 methods over ctx.remote.skillMcpManager)
   ▼
Host half (dsh-skill-mcp-manager)
   ├─ Skills  →  ~/.agents/skills/<name>/SKILL.md   (filesystem provider watches)
   └─ MCP     →  settings ns "skill-mcp-manager.mcpServers"  (durable truth)
                 └─ reconcile → ~/.dsh/cordis.patch.yml  ← insert rows
                                   └─ profile-boot's watchUserPatches (HMR)
                                         → loader mounts/disposes dsh-mcp-client
```

### Skills

- Add (typed): validates kebab-case name, writes `<root>/<name>/SKILL.md` in the
  standard frontmatter format (`name`, `description`, optional `whenToUse`).
- Add (upload): pick a `.md` file and the host keeps its **body verbatim** and
  preserves its frontmatter keys (`whenToUse`, `disable-model-invocation`,
  `user-invocable`, and any custom keys such as `metadata`); the form's name and
  description (and `whenToUse`, when typed) take precedence over the file's.
  Uploads are capped at 1 MB.
- Toggle: rewrites only `disable-model-invocation` / `user-invocable`, body and
  every other frontmatter key preserved byte-for-byte.
- List: scans the configured roots (`~/.agents/skills` by default) one level
  deep — bundle dirs and flat `.md` files — parsing the same format
  `dsh-skill-filesystem` uses.

### MCP servers

- Settings is the source of truth. On every change the manager rewrites
  `$DSH_HOME/cordis.patch.yml`, **preserving every row it does not own**
  (including `!!js` expressions, which round-trip verbatim through the same
  js-yaml dialect the loader include uses). It never touches a file that is
  already in sync, so manual comments survive until an actual change.
- Live status comes from `ctx.loader` entries filtered to
  `@deepseek-ai/dsh-mcp-client`, so a server added outside the manager shows up
  too (marked *external*), and connect failures surface as `failed`/`pending`.
- The `@deepseek-ai/dsh-mcp-client` bridge is imported only as a resolvability
  probe; the GUI shows explicit install guidance when it is missing.

## Verification

- `node tests/smoke.mjs` — host-half smoke test (stubbed context, temp dirs;
  never touches `$DSH_HOME`).
- Second-instance integration (temp `DSH_HOME`, `dsh --profile <it>` on a free
  port): the manager's patch format is applied by the real loader, a fixture
  stdio MCP server handshakes, and **live add + live remove** via home-patch
  rewrites were observed (zero restart). The browser boot manifest includes the
  package and its `/plugins/dsh-skill-mcp-manager/client.js` serves 200.

## Config (plugin-level)

| Field | Default | Meaning |
|---|---|---|
| `skillRoots` | `[]` → `~/.agents/skills` | Absolute or `~` roots to list/manage |
| `mcpPatchTarget` | `''` → `$DSH_HOME/cordis.patch.yml` | Patch file rows are projected into |

## Known limitations

- **Disable-only skill removal** in v1 (per scope decision); deleting files is a
  follow-up. `~/.agents/.skill-lock.json` (a third-party installer's manifest)
  is never touched and may not reflect changes made here.
- The patch file is re-serialized on real changes, which drops its comments
  (the "managed by" header is regenerated). Only rewrite when content drifts.
- A serverName you also hand-maintain in another patch layer is flagged in the
  UI as a collision; the manager never deletes rows it does not own.
- The first boot writes pre-existing settings into the patch file; on surfaces
  where no HMR watcher is active yet that picks it up on the next run — the GUI
  flow (save from the UI) happens after boot, when the watcher is live.
