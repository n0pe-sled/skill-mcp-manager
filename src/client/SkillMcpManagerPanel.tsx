/**
 * The Skill & MCP Manager settings page: two tabs over the host RPC surface.
 *
 * - **Skills**: list the managed skill roots, add a new `SKILL.md` bundle, and
 *   toggle each skill's model/user invocation visibility (frontmatter rewrite).
 * - **MCP Servers**: list the managed servers plus their live loader status,
 *   add (stdio / streamable-http), and remove. Every save persists the whole
 *   server set through the settings namespace and hot-applies `$DSH_HOME/
 *   cordis.patch.yml` via the host reconcile.
 *
 * Everything arrives through the props shares (AGENTS.md): the injected RPC
 * callbacks only. The component never sees `ctx`.
 */

import { Fragment, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  AddSkillInput, McpSaveOutcome, McpServerDefinition, McpServerPhase,
  McpSnapshot, RemoteCallOutcome, SetSkillInvocableInput, SkillMutationOutcome, SkillsSnapshot,
  SkillUploadPreview, SourceMarkdownFile,
} from '../shared/remote.ts'

/** Registration-side face the settings.section entry injects. */
export interface SkillMcpManagerInjected {
  listSkills(): Promise<RemoteCallOutcome<SkillsSnapshot>>
  addSkill(input: AddSkillInput): Promise<RemoteCallOutcome<SkillMutationOutcome>>
  previewSkillUpload(source: SourceMarkdownFile): Promise<RemoteCallOutcome<SkillUploadPreview>>
  setSkillInvocable(input: SetSkillInvocableInput): Promise<RemoteCallOutcome<SkillMutationOutcome>>
  listMcpServers(): Promise<RemoteCallOutcome<McpSnapshot>>
  saveMcpServers(servers: McpServerDefinition[]): Promise<RemoteCallOutcome<McpSaveOutcome>>
}

/** Client-visible outcome of one Remote call (re-exported for the entry). */
export type SkillMcpManagerOutcome<T> = RemoteCallOutcome<T>

/** Full component props: section owner share + inject face. */
export type SkillMcpManagerPanelProps =
  PropsRuntime<'settings.section'> & InjectFace<SkillMcpManagerInjected>

type Tab = 'skills' | 'mcp'

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 20px',
    maxWidth: '760px',
  } as const,
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  },
  tabs: {
    display: 'flex',
    gap: '6px',
  } as const,
  tab: {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-1)',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
  },
  tabActive: {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
    cursor: 'pointer',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 14px',
    background: 'var(--dsw-alias-bg-layer-0)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '10px',
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'space-between',
  } as const,
  fieldLabel: {
    margin: '6px 0 2px',
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '96px',
    padding: '8px 10px',
    fontSize: '13px',
    lineHeight: '1.5',
    fontFamily: MONOSPACE,
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '6px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  hint: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-label-tertiary)',
  },
  notice: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-brand-text)',
  },
  error: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-interactive-bg-hover-danger)',
  },
  status: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  button: {
    padding: '6px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-primary)',
    cursor: 'pointer',
  },
  primaryButton: {
    padding: '6px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-interactive-bg-hover-danger)',
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  } as const,
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 12px',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '8px',
  } as const,
  itemLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  } as const,
  itemTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  },
  caption: {
    margin: 0,
    fontSize: '11.5px',
    fontFamily: MONOSPACE,
    color: 'var(--dsw-alias-label-tertiary)',
    wordBreak: 'break-all' as const,
  },
  badge: {
    padding: '1px 8px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '999px',
    color: 'var(--dsw-alias-label-tertiary)',
    background: 'var(--dsw-alias-bg-layer-2)',
    border: '1px solid var(--dsw-alias-border-l2)',
    whiteSpace: 'nowrap' as const,
  },
  phaseBadge: {
    padding: '1px 8px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '999px',
    whiteSpace: 'nowrap' as const,
  } as const,
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as const,
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0 12px',
  } as const,
  tableWrap: {
    overflowY: 'auto',
    maxHeight: '360px',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '8px',
  } as const,
  table: {
    width: '100%',
    // Separate borders + zero spacing so the sticky header sticks reliably
    // inside the scroll container (collapse breaks sticky in some browsers).
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: '13px',
  } as const,
  th: {
    position: 'sticky',
    top: 0,
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: '11.5px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--dsw-alias-label-tertiary)',
    background: 'var(--dsw-alias-bg-layer-2)',
    borderBottom: '1px solid var(--dsw-alias-border-l2)',
    whiteSpace: 'nowrap' as const,
  } as const,
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--dsw-alias-border-l1)',
    color: 'var(--dsw-alias-label-primary)',
    verticalAlign: 'middle' as const,
  } as const,
  trClickable: {
    cursor: 'pointer',
  } as const,
  expander: {
    width: '22px',
    height: '22px',
    padding: 0,
    fontSize: '14px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '5px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
  } as const,
  detailRow: {
    background: 'var(--dsw-alias-bg-layer-0)',
  } as const,
  detailCell: {
    padding: '10px 12px 12px 42px',
    borderBottom: '1px solid var(--dsw-alias-border-l1)',
  } as const,
  thStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  } as const,
  toggleAllButton: {
    padding: '2px 8px',
    fontSize: '11px',
    borderRadius: '4px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-1)',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as const,
}

/** Chip color per live phase (fall back on the alias if a var is unknown). */
const PHASE_TEXT: Record<McpServerPhase, string> = {
  active: 'connected',
  pending: 'connecting…',
  failed: 'failed',
  unknown: 'not loaded',
}
const PHASE_COLOR: Record<McpServerPhase, string> = {
  active: 'var(--dsw-alias-positive-fill, #1d9e6b)',
  pending: 'var(--dsw-alias-warning-fill, #b7791f)',
  failed: 'var(--dsw-alias-interactive-bg-hover-danger)',
  unknown: 'var(--dsw-alias-label-tertiary)',
}

/** Parse `KEY=value` textarea lines into a string dict, ignoring blanks. */
function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    const key = (eq === -1 ? line : line.slice(0, eq)).trim()
    const value = (eq === -1 ? '' : line.slice(eq + 1)).trim()
    if (key !== '') out[key] = value
  }
  return out
}

/** Default MCP server definition skeleton for the Add form. */
function emptyMcpDraft(): McpServerDefinition {
  return {
    id: '',
    serverName: '',
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    cwd: '',
    url: '',
    headers: {},
    toolCallTimeoutMs: 60000,
    failOnStartupError: false,
  }
}

const EMPTY_SKILLS: SkillsSnapshot = { roots: [], skills: [], errors: [] }
const EMPTY_MCP: McpSnapshot = { servers: [], live: [], bridgeResolvable: true, patchPath: '', warnings: [] }

/** A chosen markdown file awaiting submission. */
interface PickedSkillFile {
  readonly name: string
  readonly content: string
}

interface SkillFormState {
  name: string
  description: string
  whenToUse: string
  body: string
  /** A selected .md file; when set it supplies the body (and its frontmatter). */
  sourceFile: PickedSkillFile | null
  /** Model-facing visibility (frontmatter `disable-model-invocation`). */
  modelInvocable: boolean
  /** User-facing visibility (frontmatter `user-invocable`). */
  userInvocable: boolean
}

const EMPTY_SKILL_FORM: SkillFormState = {
  name: '', description: '', whenToUse: '', body: '', sourceFile: null,
  modelInvocable: true, userInvocable: true,
}

/** Upload cap mirrored from the host (`MAX_UPLOAD_BYTES`). */
const MAX_UPLOAD_BYTES = 1024 * 1024

/** Render the Skills & MCP settings page. */
export function SkillMcpManagerPanel(props: SkillMcpManagerPanelProps) {
  const [tab, setTab] = useState<Tab>('skills')

  // ---- Skills tab state -------------------------------------------------
  const [skills, setSkills] = useState<SkillsSnapshot>(EMPTY_SKILLS)
  const [skillsError, setSkillsError] = useState<string | null>(null)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillForm, setSkillForm] = useState<SkillFormState>(EMPTY_SKILL_FORM)
  const [skillActionNote, setSkillActionNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [togglingAll, setTogglingAll] = useState<'model' | 'user' | null>(null)
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ---- MCP tab state ----------------------------------------------------
  const [mcp, setMcp] = useState<McpSnapshot>(EMPTY_MCP)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpDraft, setMcpDraft] = useState<McpServerDefinition>(emptyMcpDraft)
  const [mcpActionNote, setMcpActionNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const refreshSkills = async () => {
    setSkillsLoading(true)
    const outcome = await props.listSkills()
    if (outcome.ok) {
      setSkills(outcome.value)
      setSkillsError(null)
    } else {
      setSkillsError(outcome.error)
    }
    setSkillsLoading(false)
  }

  const refreshMcp = async () => {
    setMcpLoading(true)
    const outcome = await props.listMcpServers()
    if (outcome.ok) {
      setMcp(outcome.value)
      setMcpError(null)
    } else {
      setMcpError(outcome.error)
    }
    setMcpLoading(false)
  }

  // Initial + manual refresh; MCP also re-reads shortly after a save so the
  // hot-applied loader status has time to settle.
  useEffect(() => {
    void refreshSkills()
    void refreshMcp()
  }, [])

  const saveMcp = async (servers: McpServerDefinition[]) => {
    setSaving(true)
    setMcpActionNote(null)
    const outcome = await props.saveMcpServers(servers)
    if (outcome.ok) {
      const note = outcome.value.ok
        ? (outcome.value.applied
          ? 'Saved and applied — the patch layer was updated; the DSH hot reload reconnects servers momentarily.'
          : 'Saved — the patch layer was already in sync.')
        : `Save did not apply: ${outcome.value.error}`
      setMcpActionNote({ ok: outcome.value.ok, text: note })
    } else {
      setMcpActionNote({ ok: false, text: outcome.error })
    }
    setSaving(false)
    window.setTimeout(() => { void refreshMcp() }, 1500)
  }

  const handleAddSkill = async () => {
    const name = skillForm.name.trim()
    const description = skillForm.description.trim()
    const body = skillForm.body
    if (name === '' && skillForm.sourceFile === null) {
      setSkillActionNote({ ok: false, text: 'Give the skill a name, or upload a .md file to derive one.' })
      return
    }
    setSkillActionNote(null)
    const input: AddSkillInput = {
      name,
      description,
      body,
      modelInvocable: skillForm.modelInvocable,
      userInvocable: skillForm.userInvocable,
      ...(skillForm.whenToUse.trim() !== '' ? { whenToUse: skillForm.whenToUse.trim() } : {}),
      ...(skillForm.sourceFile !== null ? { sourceFile: skillForm.sourceFile } : {}),
    }
    const outcome = await props.addSkill(input)
    if (outcome.ok) {
      if (outcome.value.ok) {
        setSkillActionNote({ ok: true, text: `Created ${outcome.value.path}` })
        setSkillForm(EMPTY_SKILL_FORM)
        void refreshSkills()
      } else {
        setSkillActionNote({ ok: false, text: outcome.value.error })
      }
    } else {
      setSkillActionNote({ ok: false, text: outcome.error })
    }
  }

  /** Read a picked .md file, stage it, and pre-fill EVERY editable field. */
  const handlePickSkillFile = async (file: File | null) => {
    if (file === null) return
    if (!file.name.toLowerCase().endsWith('.md')) {
      setSkillActionNote({ ok: false, text: `"${file.name}" is not a .md file.` })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSkillActionNote({ ok: false, text: `"${file.name}" is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB).` })
      return
    }
    const content = await file.text()
    setSkillForm(current => ({ ...current, sourceFile: { name: file.name, content } }))
    setSkillActionNote(null)
    // Parse the file's frontmatter so name/description/whenToUse/visibility are
    // filled without the user retyping them. Empty text fields get filled;
    // visibility toggles follow the file (both editable afterwards).
    const preview = await props.previewSkillUpload({ name: file.name, content })
    if (preview.ok) {
      const p = preview.value
      setSkillForm(current => ({
        ...current,
        sourceFile: { name: file.name, content },
        name: current.name.trim() !== '' ? current.name : p.name,
        description: current.description.trim() !== '' ? current.description : p.description,
        whenToUse: current.whenToUse.trim() !== '' && p.whenToUse !== undefined ? current.whenToUse : (p.whenToUse ?? ''),
        modelInvocable: p.modelInvocable,
        userInvocable: p.userInvocable,
      }))
    } else {
      setSkillActionNote({ ok: false, text: `Could not read the file's metadata: ${preview.error}` })
    }
  }

  const handleClearSkillFile = () => {
    setSkillForm(current => ({ ...current, sourceFile: null }))
  }

  /** Collapse/expand a skill row so its details (description, path, toggles) show. */
  const toggleExpand = (path: string) => {
    setExpandedSkills(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleToggleSkill = async (name: string, modelInvocable: boolean, userInvocable: boolean) => {
    setToggling(name)
    setSkillActionNote(null)
    const outcome = await props.setSkillInvocable({ name, modelInvocable, userInvocable })
    if (outcome.ok) {
      if (outcome.value.ok) {
        setSkillActionNote({ ok: true, text: `Updated ${name}` })
      } else {
        setSkillActionNote({ ok: false, text: outcome.value.error })
      }
    } else {
      setSkillActionNote({ ok: false, text: outcome.error })
    }
    setToggling(null)
    void refreshSkills()
  }

  /** Batch-set one visibility flag across every listed skill. */
  const handleToggleAll = async (field: 'model' | 'user', value: boolean) => {
    setTogglingAll(field)
    setSkillActionNote(null)
    for (const skill of skills.skills) {
      const modelInvocable = field === 'model' ? value : skill.modelInvocable
      const userInvocable = field === 'user' ? value : skill.userInvocable
      const outcome = await props.setSkillInvocable({ name: skill.name, modelInvocable, userInvocable })
      if (outcome.ok) {
        if (!outcome.value.ok) {
          setSkillActionNote({ ok: false, text: `Could not update ${skill.name}: ${outcome.value.error}` })
          setTogglingAll(null)
          void refreshSkills()
          return
        }
      } else {
        setSkillActionNote({ ok: false, text: `Could not update ${skill.name}: ${outcome.error}` })
        setTogglingAll(null)
        void refreshSkills()
        return
      }
    }
    setSkillActionNote({ ok: true, text: `Set ${field === 'model' ? 'model' : 'user'} visibility ${value ? 'on' : 'off'} for all skills.` })
    setTogglingAll(null)
    void refreshSkills()
  }

  const handleRemoveServer = async (id: string) => {
    const next = mcp.servers.filter(server => server.id !== id)
    void saveMcp(next)
  }

  const handleAddServer = async () => {
    const serverName = mcpDraft.serverName.trim()
    if (serverName === '') {
      setMcpActionNote({ ok: false, text: 'serverName is required ([A-Za-z0-9_-], max 32 chars).' })
      return
    }
    if (mcp.servers.some(server => server.serverName === serverName)) {
      setMcpActionNote({ ok: false, text: `serverName "${serverName}" is already configured.` })
      return
    }
    const next: McpServerDefinition = {
      ...mcpDraft,
      id: `dsh-mcp-manager-${serverName}`,
      serverName,
    }
    void saveMcp([...mcp.servers, next])
  }

  const phaseBadge = (phase: McpServerPhase) => (
    <span style={{ ...styles.phaseBadge, color: PHASE_COLOR[phase], border: `1px solid ${PHASE_COLOR[phase]}` }}>
      {PHASE_TEXT[phase]}
    </span>
  )

  const allModelShown = skills.skills.length > 0 && skills.skills.every(skill => skill.modelInvocable)
  const allUserShown = skills.skills.length > 0 && skills.skills.every(skill => skill.userInvocable)

  return (
    <div style={styles.root}>
      <h2 style={styles.title}>Skills &amp; MCP Servers</h2>
      <div style={styles.tabs}>
        <button type="button" style={tab === 'skills' ? styles.tabActive : styles.tab} onClick={() => setTab('skills')}>
          Skills
        </button>
        <button type="button" style={tab === 'mcp' ? styles.tabActive : styles.tab} onClick={() => setTab('mcp')}>
          MCP Servers
        </button>
      </div>

      {tab === 'skills'
        ? (
          <section aria-label="Skills">
            <div style={styles.card}>
              <div style={styles.row}>
                <h3 style={{ ...styles.title, fontSize: '13.5px' }}>Managed skills</h3>
                <button type="button" style={styles.button} onClick={() => { void refreshSkills() }} disabled={skillsLoading}>
                  {skillsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <p style={styles.hint}>
                Listed from {skills.roots.length === 0 ? 'the managed root' : skills.roots.map(root => root.path).join(', ')}.
                Adding writes a standard SKILL.md bundle the filesystem provider picks up automatically.
              </p>
              {skillsError !== null
                ? <p style={styles.error} role="status">{skillsError}</p>
                : null}
              {skillActionNote !== null
                ? (
                  <p style={skillActionNote.ok ? styles.notice : styles.error} role="status">
                    {skillActionNote.text}
                  </p>
                )
                : null}
              {skills.skills.length === 0 && skillsError === null
                ? <p style={styles.status} role="status">No skills found in the managed root yet.</p>
                : null}
              {skills.errors.length > 0
                ? skills.errors.map(error => (
                  <p key={error} style={styles.error} role="status">{error}</p>
                ))
                : null}
              {skills.skills.length > 0
                ? (
                  <div style={styles.tableWrap}>
                    <table style={styles.table} aria-label="Managed skills">
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, width: '36px' }} aria-label="Expanded" />
                          <th style={styles.th}>Name</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>
                            <div style={styles.thStack}>
                              <span>Show to model</span>
                              <button
                                type="button"
                                style={styles.toggleAllButton}
                                disabled={togglingAll !== null}
                                onClick={() => void handleToggleAll('model', !allModelShown)}
                              >
                                {allModelShown ? 'Hide all' : 'Show all'}
                              </button>
                            </div>
                          </th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>
                            <div style={styles.thStack}>
                              <span>Show to user</span>
                              <button
                                type="button"
                                style={styles.toggleAllButton}
                                disabled={togglingAll !== null}
                                onClick={() => void handleToggleAll('user', !allUserShown)}
                              >
                                {allUserShown ? 'Hide all' : 'Show all'}
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {skills.skills.map(skill => {
                          const isOpen = expandedSkills.has(skill.path)
                          return (
                            <Fragment key={skill.path}>
                              <tr style={styles.trClickable} onClick={() => toggleExpand(skill.path)}>
                                <td style={styles.td}>
                                  <button
                                    type="button"
                                    style={styles.expander}
                                    aria-expanded={isOpen}
                                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${skill.name}`}
                                    onClick={event => {
                                      event.stopPropagation()
                                      toggleExpand(skill.path)
                                    }}
                                  >
                                    {isOpen ? '−' : '+'}
                                  </button>
                                </td>
                                <td style={styles.td}><span style={styles.itemTitle}>{skill.name}</span></td>
                                <td style={{ ...styles.td, textAlign: 'center' }} onClick={event => event.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={skill.modelInvocable}
                                    disabled={toggling === skill.name || togglingAll !== null}
                                    aria-label={`Show ${skill.name} to the model`}
                                    onChange={event => void handleToggleSkill(skill.name, event.target.checked, skill.userInvocable)}
                                  />
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }} onClick={event => event.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={skill.userInvocable}
                                    disabled={toggling === skill.name || togglingAll !== null}
                                    aria-label={`Show ${skill.name} to the user`}
                                    onChange={event => void handleToggleSkill(skill.name, skill.modelInvocable, event.target.checked)}
                                  />
                                </td>
                              </tr>
                              {isOpen
                                ? (
                                  <tr style={styles.detailRow}>
                                    <td colSpan={4} style={styles.detailCell}>
                                      {skill.description !== ''
                                        ? <p style={styles.hint}>{skill.description}</p>
                                        : null}
                                      <p style={styles.caption}>{skill.path}</p>
                                    </td>
                                  </tr>
                                )
                                : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
                : null}
            </div>

            <div style={styles.card}>
              <h3 style={{ ...styles.title, fontSize: '13.5px' }}>Add skill</h3>
              {/* Keep styling simple: two-per-row where it fits, full width for body. */}
              <label style={styles.fieldLabel}>Name (kebab-case)</label>
              <input
                style={styles.input}
                aria-label="Skill name"
                value={skillForm.name}
                placeholder="e.g. commit-message-review"
                onChange={event => setSkillForm(current => ({ ...current, name: event.target.value }))}
                spellCheck={false}
              />
              <label style={styles.fieldLabel}>Description</label>
              <input
                style={styles.input}
                aria-label="Skill description"
                value={skillForm.description}
                placeholder="One sentence: when to use this skill"
                onChange={event => setSkillForm(current => ({ ...current, description: event.target.value }))}
              />
              <label style={styles.fieldLabel}>When to use (optional)</label>
              <input
                style={styles.input}
                aria-label="When to use"
                value={skillForm.whenToUse}
                placeholder="e.g. Always for pull request commits"
                onChange={event => setSkillForm(current => ({ ...current, whenToUse: event.target.value }))}
              />
              <label style={styles.fieldLabel}>Upload a .md file (optional)</label>
              <div style={styles.actions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  style={{ display: 'none' }}
                  aria-label="Upload skill markdown file"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    void handlePickSkillFile(file)
                    // Reset the input so re-picking the same file re-triggers change.
                    event.target.value = ''
                  }}
                />
                <button type="button" style={styles.button} onClick={() => fileInputRef.current?.click()}>
                  Choose file…
                </button>
                {skillForm.sourceFile !== null
                  ? (
                    <>
                      <span style={styles.status}>{skillForm.sourceFile.name}</span>
                      <button type="button" style={styles.button} onClick={handleClearSkillFile}>
                        Clear
                      </button>
                    </>
                  )
                  : null}
              </div>
              {skillForm.sourceFile !== null
                ? (
                  <p style={styles.notice}>
                    Fields were pre-filled from the file&apos;s frontmatter (title, description,&nbsp;
                    {`whenToUse`}, visibility) — edit any of them before adding. The file&apos;s body and any
                    custom frontmatter keys are kept as-is.
                  </p>
                )
                : null}
              <label style={styles.fieldLabel}>Instructions</label>
              <textarea
                style={{
                  ...styles.textarea,
                  ...(skillForm.sourceFile !== null ? styles.disabled : {}),
                }}
                aria-label="Skill instructions"
                value={skillForm.body}
                disabled={skillForm.sourceFile !== null}
                placeholder={'## What this skill does\n\nStep-by-step instructions the model should follow…'}
                onChange={event => setSkillForm(current => ({ ...current, body: event.target.value }))}
              />
              <div style={styles.itemLine}>
                <label style={styles.switchRow}>
                  <input
                    type="checkbox"
                    checked={skillForm.modelInvocable}
                    onChange={event => setSkillForm(current => ({ ...current, modelInvocable: event.target.checked }))}
                  />
                  <span style={styles.hint}>Show to model</span>
                </label>
                <label style={styles.switchRow}>
                  <input
                    type="checkbox"
                    checked={skillForm.userInvocable}
                    onChange={event => setSkillForm(current => ({ ...current, userInvocable: event.target.checked }))}
                  />
                  <span style={styles.hint}>Show to user</span>
                </label>
              </div>
              <div style={styles.actions}>
                <button type="button" style={styles.primaryButton} onClick={() => { void handleAddSkill() }}>
                  Add skill
                </button>
              </div>
            </div>
          </section>
        )
        : (
          <section aria-label="MCP Servers">
            {!mcp.bridgeResolvable
              ? (
                <div style={styles.card}>
                  <p style={styles.error} role="status">
                    The MCP client bridge (@deepseek-ai/dsh-mcp-client) does not resolve in this process.
                    Install it into the profile (e.g. add &quot;@deepseek-ai/dsh-mcp-client&quot;: &quot;0.1.1-rc.2&quot;
                    to the profile&apos;s package.json and reinstall), then restart — saved servers otherwise fail to connect.
                  </p>
                </div>
              )
              : null}
            <div style={styles.card}>
              <div style={styles.row}>
                <h3 style={{ ...styles.title, fontSize: '13.5px' }}>Configured MCP servers</h3>
                <button type="button" style={styles.button} onClick={() => { void refreshMcp() }} disabled={mcpLoading}>
                  {mcpLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <p style={styles.hint}>
                Saved into <span style={{ fontFamily: MONOSPACE }}>~/.dsh/cordis.patch.yml</span> as one
                @deepseek-ai/dsh-mcp-client instance per server; DSH hot-reloads the file, so changes go live without a restart.
              </p>
              {mcpError !== null
                ? <p style={styles.error} role="status">{mcpError}</p>
                : null}
              {mcpActionNote !== null
                ? (
                  <p style={mcpActionNote.ok ? styles.notice : styles.error} role="status">
                    {mcpActionNote.text}
                  </p>
                )
                : null}
              {mcp.warnings.map(warning => (
                <p key={warning} style={styles.notice} role="status">{warning}</p>
              ))}
              {mcp.live.length === 0 && mcpError === null
                ? <p style={styles.status} role="status">No MCP servers are configured or running.</p>
                : null}
              {mcp.live.map(server => (
                <div key={`${server.id}-${server.present ? 'live' : 'cfg'}`} style={styles.item}>
                  <div style={styles.itemLine}>
                    <span style={styles.itemTitle}>{server.serverName}</span>
                    {phaseBadge(server.phase)}
                    {server.managed
                      ? <span style={styles.badge}>managed</span>
                      : <span style={styles.badge}>external</span>}
                    {!server.present ? <span style={styles.badge}>pending apply</span> : null}
                  </div>
                  <p style={styles.caption}>{server.id}</p>
                  <div style={styles.actions}>
                    {(server.managed || server.serverName !== 'unknown')
                      ? (
                        <button
                          type="button"
                          style={styles.dangerButton}
                          disabled={saving}
                          onClick={() => void handleRemoveServer(server.id)}
                        >
                          Remove
                        </button>
                      )
                      : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.card}>
              <h3 style={{ ...styles.title, fontSize: '13.5px' }}>Add server</h3>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.fieldLabel}>serverName (namespace)</label>
                  <input
                    style={styles.input}
                    aria-label="serverName"
                    value={mcpDraft.serverName}
                    placeholder="e.g. github"
                    spellCheck={false}
                    onChange={event => setMcpDraft(current => ({ ...current, serverName: event.target.value }))}
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>Transport</label>
                  <select
                    style={styles.input}
                    aria-label="Transport"
                    value={mcpDraft.transport}
                    onChange={event => setMcpDraft(current => ({
                      ...current,
                      transport: event.target.value === 'stdio' ? 'stdio' : 'streamable-http',
                    }))}
                  >
                    <option value="stdio">stdio</option>
                    <option value="streamable-http">streamable-http</option>
                  </select>
                </div>
              </div>
              {mcpDraft.transport === 'stdio'
                ? (
                  <>
                    <label style={styles.fieldLabel}>Command</label>
                    <input
                      style={styles.input}
                      aria-label="Command"
                      value={mcpDraft.command}
                      placeholder="e.g. npx"
                      spellCheck={false}
                      onChange={event => setMcpDraft(current => ({ ...current, command: event.target.value }))}
                    />
                    <label style={styles.fieldLabel}>Arguments (one per line)</label>
                    <textarea
                      style={{ ...styles.textarea, minHeight: '64px' }}
                      aria-label="Arguments"
                      value={mcpDraft.args.join('\n')}
                      placeholder={'-y\n@modelcontextprotocol/server-github'}
                      onChange={event => setMcpDraft(current => ({
                        ...current,
                        args: event.target.value.split('\n').filter(line => line.trim() !== ''),
                      }))}
                    />
                    <label style={styles.fieldLabel}>Environment (KEY=value, one per line)</label>
                    <textarea
                      style={{ ...styles.textarea, minHeight: '64px' }}
                      aria-label="Environment"
                      value={Object.entries(mcpDraft.env).map(([key, value]) => `${key}=${value}`).join('\n')}
                      placeholder={'GITHUB_TOKEN=ghp_…'}
                      onChange={event => setMcpDraft(current => ({
                        ...current,
                        env: parseKeyValueLines(event.target.value),
                      }))}
                    />
                    <label style={styles.fieldLabel}>Working directory (optional)</label>
                    <input
                      style={styles.input}
                      aria-label="Working directory"
                      value={mcpDraft.cwd}
                      placeholder=""
                      spellCheck={false}
                      onChange={event => setMcpDraft(current => ({ ...current, cwd: event.target.value }))}
                    />
                  </>
                )
                : (
                  <>
                    <label style={styles.fieldLabel}>URL</label>
                    <input
                      style={styles.input}
                      aria-label="URL"
                      value={mcpDraft.url}
                      placeholder="https://example.com/mcp"
                      spellCheck={false}
                      onChange={event => setMcpDraft(current => ({ ...current, url: event.target.value }))}
                    />
                    <label style={styles.fieldLabel}>Headers (KEY=value, one per line)</label>
                    <textarea
                      style={{ ...styles.textarea, minHeight: '64px' }}
                      aria-label="Headers"
                      value={Object.entries(mcpDraft.headers).map(([key, value]) => `${key}=${value}`).join('\n')}
                      placeholder={'Authorization=Bearer …'}
                      onChange={event => setMcpDraft(current => ({
                        ...current,
                        headers: parseKeyValueLines(event.target.value),
                      }))}
                    />
                  </>
                )}
              <label style={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={mcpDraft.failOnStartupError}
                  onChange={event => setMcpDraft(current => ({ ...current, failOnStartupError: event.target.checked }))}
                />
                <span style={styles.hint}>Fail activation when the initial connect/sync fails</span>
              </label>
              <div style={styles.actions}>
                <button type="button" style={saving ? { ...styles.primaryButton, ...styles.disabled } : styles.primaryButton} disabled={saving} onClick={() => { void handleAddServer() }}>
                  {saving ? 'Saving…' : 'Add server'}
                </button>
              </div>
            </div>
          </section>
        )}
    </div>
  )
}
