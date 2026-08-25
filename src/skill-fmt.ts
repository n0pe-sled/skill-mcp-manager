/**
 * Skill file format helpers: build, parse, and mutate `SKILL.md` documents on
 * the same format `@deepseek-ai/dsh-skill-filesystem` consumes — a leading YAML
 * frontmatter block (`---`-delimited) with `name`, `description`, optional
 * `whenToUse`, `disable-model-invocation` and `user-invocable`, followed by the
 * verbatim markdown body. Body edits always keep the body byte-identical; only
 * frontmatter keys change.
 */

import * as yaml from 'js-yaml'

/** Bundle entry file name. */
export const SKILL_FILE = 'SKILL.md'
/** Flat skill file extension. */
export const FLAT_SKILL_EXT = '.md'
/** Kebab-case requirement from `dsh-skill-filesystem`. */
export const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Safety cap so a malformed name cannot create a huge directory chain. */
export const SKILL_NAME_MAX = 64

/** Recognized frontmatter keys, plus any unknown keys a user chose to keep. */
export interface SkillFrontmatter {
  name?: string
  description?: string
  whenToUse?: string
  'disable-model-invocation'?: boolean
  'user-invocable'?: boolean
  [key: string]: unknown
}

/** A parsed skill document: frontmatter data plus the raw body. */
export interface ParsedSkillDoc {
  readonly data: SkillFrontmatter
  /** Everything after the closing `---` (verbatim, leading blank line trimmed once). */
  readonly body: string
}

/** Options for building a document from a NEW skill (typed-into UI). */
export interface SkillDocInput {
  readonly name: string
  readonly description: string
  readonly body: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/** Options for building a document from an uploaded markdown source. */
export interface SkillDocFromPartsInput {
  readonly name: string
  readonly description: string
  readonly body: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
  /**
   * Additional frontmatter keys to preserve from the uploaded source
   * (`metadata`, custom keys, …). Standalone keys this builder owns are
   * managed here, not in `extra`.
   */
  readonly extra?: Readonly<Record<string, unknown>>
}

/** Effective invocation flags derived from frontmatter. */
export interface SkillInvocation {
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/** Whether a skill name is valid kebab-case. */
export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_RE.test(name) && name.length <= SKILL_NAME_MAX
}

/** Effective invocation flags; missing keys default to permitting that surface. */
export function invocationOf(data: SkillFrontmatter): SkillInvocation {
  return {
    modelInvocable: data['disable-model-invocation'] !== true,
    userInvocable: data['user-invocable'] !== false,
  }
}

/**
 * Split a document at its frontmatter. `{ data: {}, body: text }` when there is
 * no leading `---` block.
 */
export function parseSkillDoc(text: string): ParsedSkillDoc {
  const lines = text.split('\n')
  if (lines[0]?.trim() === '---') {
    const end = lines.slice(1).findIndex(line => line.trim() === '---')
    if (end !== -1) {
      const raw = lines.slice(1, 1 + end).join('\n')
      const body = lines.slice(2 + end).join('\n').replace(/^\n/, '')
      let data: SkillFrontmatter = {}
      try {
        const parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA }) as unknown
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) data = parsed as SkillFrontmatter
      } catch {
        // A malformed frontmatter block is treated as no frontmatter: the body
        // (including the unparsable lines) is preserved for round-tripping.
        return { data: {}, body: text }
      }
      return { data, body }
    }
  }
  return { data: {}, body: text }
}

/**
 * Serialize one frontmatter map to the `---`-delimited block. js-yaml's dump
 * omits the trailing newline, so the closing delimiter is placed on its own
 * line explicitly (the filesystem provider splits on `---` lines).
 */
function stringifyFrontmatter(data: SkillFrontmatter): string {
  const dumped = yaml.dump(data, { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: -1 }).trimEnd()
  return `---\n${dumped}\n---`
}

/**
 * Build a full skill document (frontmatter + padded body) for a NEW skill
 * entered through the UI.
 */
export function buildSkillDoc(input: SkillDocInput): string {
  return buildSkillDocFromParts(input)
}

/**
 * Build a full skill document from explicit parts, preserving any extra
 * frontmatter keys carried over from an uploaded source file. The five managed
 * keys (`name`, `description`, `whenToUse`, `disable-model-invocation`,
 * `user-invocable`) always come from the parts; everything else lands verbatim
 * from `extra`.
 */
export function buildSkillDocFromParts(input: SkillDocFromPartsInput): string {
  const data: SkillFrontmatter = { ...input.extra }
  data.name = input.name
  data.description = input.description
  if (input.whenToUse !== undefined && input.whenToUse !== '') data.whenToUse = input.whenToUse
  if (input.modelInvocable) {
    delete data['disable-model-invocation']
  } else {
    data['disable-model-invocation'] = true
  }
  if (input.userInvocable) {
    delete data['user-invocable']
  } else {
    data['user-invocable'] = false
  }
  const body = input.body.trim() + '\n'
  return `${stringifyFrontmatter(data)}\n\n${body}`
}

/**
 * Rewrite only the two invocation keys of an existing document, preserving
 * every other frontmatter key and the body verbatim. Enabling a surface omits
 * the inhibiting key entirely (leaving a clean, idempotent file).
 */
export function setSkillInvocation(
  text: string,
  invocation: SkillInvocation,
): string {
  const { data, body } = parseSkillDoc(text)
  const next: SkillFrontmatter = { ...data }
  if (invocation.modelInvocable) {
    delete next['disable-model-invocation']
  } else {
    next['disable-model-invocation'] = true
  }
  if (invocation.userInvocable) {
    delete next['user-invocable']
  } else {
    next['user-invocable'] = false
  }
  return `${stringifyFrontmatter(next)}\n\n${body}`
}
