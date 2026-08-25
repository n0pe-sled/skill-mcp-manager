import Schema from "@deepseek-ai/schemastery";
import { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import { Context } from "@deepseek-ai/cordis";
//#region src/shared/remote.d.ts
/** How one skill is stored on disk under a root. */
type SkillKind = 'bundle' | 'flat';
/** One discovered skill under a managed root. */
interface SkillView {
  /** Kebab-case skill name (bundle directory or flat file basename). */
  readonly name: string;
  /** Frontmatter `description` (empty when absent). */
  readonly description: string;
  /** Absolute path of the containing root. */
  readonly root: string;
  /** Human label of the containing root. */
  readonly rootLabel: string;
  /** `bundle` = `<root>/<name>/SKILL.md`, `flat` = `<root>/<name>.md`. */
  readonly kind: SkillKind;
  /** Absolute path of the skill's source file. */
  readonly path: string;
  /** Effjective model-facing visibility from `disable-model-invocation`. */
  readonly modelInvocable: boolean;
  /** Effective user-facing visibility from `user-invocable`. */
  readonly userInvocable: boolean;
}
/** One scanned skill root. */
interface SkillRootInfo {
  /** Stable label shown in the UI. */
  readonly name: string;
  /** Absolute path. */
  readonly path: string;
}
/** Full skills snapshot: roots, discovered skills, and per-root diagnostics. */
interface SkillsSnapshot {
  readonly roots: readonly SkillRootInfo[];
  readonly skills: readonly SkillView[];
  /** Read/scan diagnostics so partial failures never hide the rest. */
  readonly errors: readonly string[];
}
/** A verbatim markdown file uploaded as a skill source. */
interface SourceMarkdownFile {
  /** Original file name (display/validation only). */
  readonly name: string;
  /** Full file text, verbatim (may carry its own `---` frontmatter). */
  readonly content: string;
}
/**
 * Derived skill metadata from an uploaded file, returned so the form can be
 * pre-filled instead of requiring the user to retype the title/description.
 */
interface SkillUploadPreview {
  /** Kebab-case suggested name (frontmatter `name`, else slugified H1/file name). */
  readonly name: string;
  /** Description from frontmatter (empty when absent). */
  readonly description: string;
  /** `whenToUse` from frontmatter, when present. */
  readonly whenToUse?: string;
  /** Model-facing visibility from the file's `disable-model-invocation`. */
  readonly modelInvocable: boolean;
  /** User-facing visibility from the file's `user-invocable`. */
  readonly userInvocable: boolean;
}
/** Payload of one Add-skill request. */
interface AddSkillInput {
  /** Kebab-case skill name (also the on-disk folder name). May be empty when
   * `sourceFile` is set — the host then derives it from the file. */
  readonly name: string;
  /** Frontmatter `description`. */
  readonly description: string;
  /** The SKILL.md body (markdown). Ignored by the host when `sourceFile` is set. */
  readonly body: string;
  /** Optional frontmatter `whenToUse`. */
  readonly whenToUse?: string;
  /** Model-facing visibility (`disable-model-invocation`); default true. */
  readonly modelInvocable?: boolean;
  /** User-facing visibility (`user-invocable`); default true. */
  readonly userInvocable?: boolean;
  /**
   * Optional uploaded markdown file. The host keeps the file's body verbatim,
   * preserves its frontmatter keys (custom keys), and applies the form's fields
   * (`name`/`description`/`whenToUse`/invocation) on top — falling back to the
   * file's frontmatter when a form field is empty.
   */
  readonly sourceFile?: SourceMarkdownFile;
}
/** Payload of one invocation-visibility update. */
interface SetSkillInvocableInput {
  /** Existing skill name. */
  readonly name: string;
  /** New model-facing visibility (frontmatter `disable-model-invocation`). */
  readonly modelInvocable: boolean;
  /** New user-facing visibility (frontmatter `user-invocable`). */
  readonly userInvocable: boolean;
}
/** Result of a skill mutation (add / visibility update). */
type SkillMutationOutcome = {
  readonly ok: true;
  readonly path: string;
} | {
  readonly ok: false;
  readonly error: string;
};
/** Transport of one MCP server. */
type McpTransport = 'stdio' | 'streamable-http';
/**
 * One MCP server definition the manager owns. This is what is stored in the
 * `dsh-skill-mcp-manager` settings namespace and projected into
 * `$DSH_HOME/cordis.patch.yml` as one `@deepseek-ai/dsh-mcp-client` instance.
 */
interface McpServerDefinition {
  /** Stable row id: `dsh-mcp-manager-<serverName>`. */
  id: string;
  /** MCP namespace; must match `[A-Za-z0-9_-]{1,32}`, unique across live instances. */
  serverName: string;
  transport: McpTransport;
  /** stdio only: executable to spawn. */
  command: string;
  /** stdio only: arguments passed without shell interpolation. */
  args: string[];
  /** stdio only: extra env vars merged on top of scrubbed ambient env. */
  env: Record<string, string>;
  /** stdio only: working directory for the child process. */
  cwd: string;
  /** streamable-http only: MCP endpoint URL. */
  url: string;
  /** streamable-http only: extra headers attached to MCP requests. */
  headers: Record<string, string>;
  /** Per-tool-call timeout in ms (shared schema default 60000). */
  toolCallTimeoutMs: number;
  /** Reject plugin activation when the initial connect/sync fails. */
  failOnStartupError: boolean;
}
/** Effective loader phase of one mcp-client instance. */
type McpServerPhase = 'active' | 'pending' | 'failed' | 'unknown';
/** One mcp-client instance as the loader currently sees it. */
interface LiveMcpServer {
  /** Loader entry id (or the manager's row id when settings-only). */
  readonly id: string;
  readonly serverName: string;
  readonly phase: McpServerPhase;
  /** True when this row's id is managed by this plugin. */
  readonly managed: boolean;
  /** False when there is no live loader entry for the managed id. */
  readonly present: boolean;
}
/** Full MCP snapshot: managed defs, live instances, bridge availability. */
interface McpSnapshot {
  /** The managed definitions (settings source of truth). */
  readonly servers: readonly McpServerDefinition[];
  /** Live loader instances, including mcp rows not owned by the manager. */
  readonly live: readonly LiveMcpServer[];
  /** Whether `@deepseek-ai/dsh-mcp-client` resolves in this process. */
  readonly bridgeResolvable: boolean;
  /** Absolute path of the patch file the manager writes. */
  readonly patchPath: string;
  /** Non-fatal diagnostics (e.g. a manual serverName collision). */
  readonly warnings: readonly string[];
}
/** Result of saving the managed MCP server set. */
type McpSaveOutcome = {
  readonly ok: true;
  /** Whether the settings write landed (host read-back verified). */
  readonly saved: boolean;
  /** Whether the patch file was rewritten (true when a reconcile happened). */
  readonly applied: boolean;
  readonly patchPath: string;
} | {
  readonly ok: false;
  readonly error: string;
};
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'skillMcpManager/listSkills'(): Promise<RemoteResult<SkillsSnapshot>>;
    'skillMcpManager/addSkill'(input: AddSkillInput): Promise<RemoteResult<SkillMutationOutcome>>;
    'skillMcpManager/previewSkillUpload'(source: SourceMarkdownFile): Promise<RemoteResult<SkillUploadPreview>>;
    'skillMcpManager/setSkillInvocable'(input: SetSkillInvocableInput): Promise<RemoteResult<SkillMutationOutcome>>;
    'skillMcpManager/listMcpServers'(): Promise<RemoteResult<McpSnapshot>>;
    'skillMcpManager/saveMcpServers'(servers: McpServerDefinition[]): Promise<RemoteResult<McpSaveOutcome>>;
  }
  interface TypertRemoteNamespaceMap {
    skillMcpManager: {
      listSkills(): Promise<RemoteResult<SkillsSnapshot>>;
      addSkill(input: AddSkillInput): Promise<RemoteResult<SkillMutationOutcome>>;
      previewSkillUpload(source: SourceMarkdownFile): Promise<RemoteResult<SkillUploadPreview>>;
      setSkillInvocable(input: SetSkillInvocableInput): Promise<RemoteResult<SkillMutationOutcome>>;
      listMcpServers(): Promise<RemoteResult<McpSnapshot>>;
      saveMcpServers(servers: McpServerDefinition[]): Promise<RemoteResult<McpSaveOutcome>>;
    };
  }
}
//#endregion
//#region src/skill-fmt.d.ts
/** Recognized frontmatter keys, plus any unknown keys a user chose to keep. */
interface SkillFrontmatter {
  name?: string;
  description?: string;
  whenToUse?: string;
  'disable-model-invocation'?: boolean;
  'user-invocable'?: boolean;
  [key: string]: unknown;
}
/** A parsed skill document: frontmatter data plus the raw body. */
interface ParsedSkillDoc {
  readonly data: SkillFrontmatter;
  /** Everything after the closing `---` (verbatim, leading blank line trimmed once). */
  readonly body: string;
}
/** Options for building a document from a NEW skill (typed-into UI). */
interface SkillDocInput {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly whenToUse?: string;
  readonly modelInvocable: boolean;
  readonly userInvocable: boolean;
}
/** Effective invocation flags derived from frontmatter. */
interface SkillInvocation {
  readonly modelInvocable: boolean;
  readonly userInvocable: boolean;
}
/**
 * Skill metadata derived from an uploaded source file, used to pre-fill the
 * Add form (and as the host's fallback when a form field is empty).
 */
interface DerivedSkillMeta {
  /** Kebab-case suggested name: frontmatter `name`, else slugified H1/file name. */
  readonly name: string;
  /** Description from frontmatter (empty when absent). */
  readonly description: string;
  /** `whenToUse` from frontmatter, when present. */
  readonly whenToUse?: string;
  readonly modelInvocable: boolean;
  readonly userInvocable: boolean;
}
/** Best-effort kebab-case slug from an arbitrary title/file name. */
declare function slugifySkillName(raw: string): string;
/**
 * Derive the editable skill fields from an uploaded markdown file: frontmatter
 * `name` (or the body's first `#` heading, or the file name) is normalized to
 * kebab-case, `description`/`whenToUse` and the invocation flags come from
 * frontmatter. Authoritative on the host; the client uses it via the preview
 * RPC to pre-fill every field.
 */
declare function deriveSkillFromSource(content: string, fileName: string): DerivedSkillMeta;
/**
 * Split a document at its frontmatter. `{ data: {}, body: text }` when there is
 * no leading `---` block.
 */
declare function parseSkillDoc(text: string): ParsedSkillDoc;
/**
 * Build a full skill document (frontmatter + padded body) for a NEW skill
 * entered through the UI.
 */
declare function buildSkillDoc(input: SkillDocInput): string;
/**
 * Rewrite only the two invocation keys of an existing document, preserving
 * every other frontmatter key and the body verbatim. Enabling a surface omits
 * the inhibiting key entirely (leaving a clean, idempotent file).
 */
declare function setSkillInvocation(text: string, invocation: SkillInvocation): string;
//#endregion
//#region src/mcp-config.d.ts
interface PatchPlan {
  /** The full new file content (with header) when `changed` is true. */
  readonly content: string;
  /** Whether the file needs rewriting. */
  readonly changed: boolean;
  /** Identical to `changed` but explicit about the no-op reason for tests. */
  readonly reason: 'in-sync' | 'write-managed' | 'remove-stale';
}
/**
 * Produce the patch plan for one reconcile against the current file text.
 *
 * Rule: never touch a file that is already in sync. The file is rewritten only
 * when (a) managed settings need to be written, or (b) stale managed rows must
 * be removed — never merely to re-serialize an untouched file (that would strip
 * the user's comments on every startup).
 */
declare function planPatch(existingText: string | undefined, managed: readonly McpServerDefinition[]): PatchPlan;
/** Validate one complete server set for save (first error wins). */
declare function validateServerSet(servers: readonly McpServerDefinition[]): string | null;
//#endregion
//#region src/index.d.ts
declare const name = "skill-mcp-manager";
/** Services that must be mounted before this plugin runs. */
declare const inject: string[];
/** Config: which skill roots to manage and which patch file to project into. */
interface Config {
  /** Absolute or `~`-prefixed skill roots to list/manage. Empty → `~/.agents/skills`. */
  skillRoots: string[];
  /** Absolute target patch file. Empty → `$DSH_HOME/cordis.patch.yml`. */
  mcpPatchTarget: string;
}
declare const Config: Schema<Config>;
/** Persistent settings section owned by this plugin. */
interface SettingsSection {
  mcpServers: McpServerDefinition[];
}
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { type AddSkillInput, Config, type LiveMcpServer, type McpSaveOutcome, type McpServerDefinition, type McpServerPhase, type McpSnapshot, type SetSkillInvocableInput, SettingsSection, type SkillMutationOutcome, type SkillRootInfo, type SkillView, type SkillsSnapshot, apply, buildSkillDoc, deriveSkillFromSource, inject, name, parseSkillDoc, planPatch, setSkillInvocation, slugifySkillName, validateServerSet };