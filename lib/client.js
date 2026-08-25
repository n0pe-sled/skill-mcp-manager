window.__ModuleLoader__.load({
	id: "dsh-skill-mcp-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/SkillMcpManagerPanel.tsx
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
		const MONOSPACE = "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace";
		const styles = {
			root: {
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				padding: "16px 20px",
				maxWidth: "760px"
			},
			title: {
				margin: 0,
				fontSize: "15px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			tabs: {
				display: "flex",
				gap: "6px"
			},
			tab: {
				padding: "6px 12px",
				fontSize: "13px",
				borderRadius: "6px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer"
			},
			tabActive: {
				padding: "6px 12px",
				fontSize: "13px",
				borderRadius: "6px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)",
				cursor: "pointer"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "12px 14px",
				background: "var(--dsw-alias-bg-layer-0)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: "10px"
			},
			row: {
				display: "flex",
				alignItems: "center",
				gap: "10px",
				justifyContent: "space-between"
			},
			fieldLabel: {
				margin: "6px 0 2px",
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
			},
			input: {
				width: "100%",
				padding: "8px 10px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: "6px",
				boxSizing: "border-box"
			},
			textarea: {
				width: "100%",
				minHeight: "96px",
				padding: "8px 10px",
				fontSize: "13px",
				lineHeight: "1.5",
				fontFamily: MONOSPACE,
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: "6px",
				resize: "vertical",
				boxSizing: "border-box"
			},
			hint: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)"
			},
			notice: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-brand-text)"
			},
			error: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-interactive-bg-hover-danger)"
			},
			status: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
			},
			actions: {
				display: "flex",
				gap: "8px",
				flexWrap: "wrap",
				alignItems: "center"
			},
			button: {
				padding: "6px 14px",
				fontSize: "13px",
				borderRadius: "6px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-primary)",
				cursor: "pointer"
			},
			primaryButton: {
				padding: "6px 14px",
				fontSize: "13px",
				borderRadius: "6px",
				border: "none",
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)",
				cursor: "pointer"
			},
			dangerButton: {
				padding: "4px 10px",
				fontSize: "12px",
				borderRadius: "6px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-interactive-bg-hover-danger)",
				cursor: "pointer"
			},
			disabled: {
				opacity: .4,
				cursor: "not-allowed"
			},
			item: {
				display: "flex",
				flexDirection: "column",
				gap: "4px",
				padding: "10px 12px",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: "8px"
			},
			itemLine: {
				display: "flex",
				alignItems: "center",
				gap: "10px",
				flexWrap: "wrap"
			},
			itemTitle: {
				margin: 0,
				fontSize: "13px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			caption: {
				margin: 0,
				fontSize: "11.5px",
				fontFamily: MONOSPACE,
				color: "var(--dsw-alias-label-tertiary)",
				wordBreak: "break-all"
			},
			badge: {
				padding: "1px 8px",
				fontSize: "11px",
				fontWeight: 500,
				borderRadius: "999px",
				color: "var(--dsw-alias-label-tertiary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-border-l2)",
				whiteSpace: "nowrap"
			},
			phaseBadge: {
				padding: "1px 8px",
				fontSize: "11px",
				fontWeight: 600,
				borderRadius: "999px",
				whiteSpace: "nowrap"
			},
			switchRow: {
				display: "flex",
				alignItems: "center",
				gap: "6px"
			},
			formGrid: {
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: "0 12px"
			}
		};
		/** Chip color per live phase (fall back on the alias if a var is unknown). */
		const PHASE_TEXT = {
			active: "connected",
			pending: "connecting…",
			failed: "failed",
			unknown: "not loaded"
		};
		const PHASE_COLOR = {
			active: "var(--dsw-alias-positive-fill, #1d9e6b)",
			pending: "var(--dsw-alias-warning-fill, #b7791f)",
			failed: "var(--dsw-alias-interactive-bg-hover-danger)",
			unknown: "var(--dsw-alias-label-tertiary)"
		};
		/** Parse `KEY=value` textarea lines into a string dict, ignoring blanks. */
		function parseKeyValueLines(text) {
			const out = {};
			for (const raw of text.split("\n")) {
				const line = raw.trim();
				if (line === "" || line.startsWith("#")) continue;
				const eq = line.indexOf("=");
				const key = (eq === -1 ? line : line.slice(0, eq)).trim();
				const value = (eq === -1 ? "" : line.slice(eq + 1)).trim();
				if (key !== "") out[key] = value;
			}
			return out;
		}
		/** Default MCP server definition skeleton for the Add form. */
		function emptyMcpDraft() {
			return {
				id: "",
				serverName: "",
				transport: "stdio",
				command: "",
				args: [],
				env: {},
				cwd: "",
				url: "",
				headers: {},
				toolCallTimeoutMs: 6e4,
				failOnStartupError: false
			};
		}
		const EMPTY_SKILLS = {
			roots: [],
			skills: [],
			errors: []
		};
		const EMPTY_MCP = {
			servers: [],
			live: [],
			bridgeResolvable: true,
			patchPath: "",
			warnings: []
		};
		const EMPTY_SKILL_FORM = {
			name: "",
			description: "",
			whenToUse: "",
			body: "",
			sourceFile: null
		};
		/** Upload cap mirrored from the host (`MAX_UPLOAD_BYTES`). */
		const MAX_UPLOAD_BYTES = 1048576;
		/** Render the Skills & MCP settings page. */
		function SkillMcpManagerPanel(props) {
			const [tab, setTab] = (0, react.useState)("skills");
			const [skills, setSkills] = (0, react.useState)(EMPTY_SKILLS);
			const [skillsError, setSkillsError] = (0, react.useState)(null);
			const [skillsLoading, setSkillsLoading] = (0, react.useState)(false);
			const [skillForm, setSkillForm] = (0, react.useState)(EMPTY_SKILL_FORM);
			const [skillActionNote, setSkillActionNote] = (0, react.useState)(null);
			const [toggling, setToggling] = (0, react.useState)(null);
			const fileInputRef = (0, react.useRef)(null);
			const [mcp, setMcp] = (0, react.useState)(EMPTY_MCP);
			const [mcpError, setMcpError] = (0, react.useState)(null);
			const [mcpLoading, setMcpLoading] = (0, react.useState)(false);
			const [mcpDraft, setMcpDraft] = (0, react.useState)(emptyMcpDraft);
			const [mcpActionNote, setMcpActionNote] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const refreshSkills = async () => {
				setSkillsLoading(true);
				const outcome = await props.listSkills();
				if (outcome.ok) {
					setSkills(outcome.value);
					setSkillsError(null);
				} else setSkillsError(outcome.error);
				setSkillsLoading(false);
			};
			const refreshMcp = async () => {
				setMcpLoading(true);
				const outcome = await props.listMcpServers();
				if (outcome.ok) {
					setMcp(outcome.value);
					setMcpError(null);
				} else setMcpError(outcome.error);
				setMcpLoading(false);
			};
			(0, react.useEffect)(() => {
				refreshSkills();
				refreshMcp();
			}, []);
			const saveMcp = async (servers) => {
				setSaving(true);
				setMcpActionNote(null);
				const outcome = await props.saveMcpServers(servers);
				if (outcome.ok) {
					const note = outcome.value.ok ? outcome.value.applied ? "Saved and applied — the patch layer was updated; the DSH hot reload reconnects servers momentarily." : "Saved — the patch layer was already in sync." : `Save did not apply: ${outcome.value.error}`;
					setMcpActionNote({
						ok: outcome.value.ok,
						text: note
					});
				} else setMcpActionNote({
					ok: false,
					text: outcome.error
				});
				setSaving(false);
				window.setTimeout(() => {
					refreshMcp();
				}, 1500);
			};
			const handleAddSkill = async () => {
				const name = skillForm.name.trim();
				const description = skillForm.description.trim();
				const body = skillForm.body;
				if (name === "") {
					setSkillActionNote({
						ok: false,
						text: "Give the skill a name."
					});
					return;
				}
				setSkillActionNote(null);
				const input = {
					name,
					description,
					body,
					...skillForm.whenToUse.trim() !== "" ? { whenToUse: skillForm.whenToUse.trim() } : {},
					...skillForm.sourceFile !== null ? { sourceFile: skillForm.sourceFile } : {}
				};
				const outcome = await props.addSkill(input);
				if (outcome.ok) {
					if (outcome.value.ok) {
						setSkillActionNote({
							ok: true,
							text: `Created ${outcome.value.path}`
						});
						setSkillForm(EMPTY_SKILL_FORM);
						refreshSkills();
					} else setSkillActionNote({
						ok: false,
						text: outcome.value.error
					});
				} else setSkillActionNote({
					ok: false,
					text: outcome.error
				});
			};
			/** Read a picked .md file and stage it as the skill body source. */
			const handlePickSkillFile = async (file) => {
				if (file === null) return;
				if (!file.name.toLowerCase().endsWith(".md")) {
					setSkillActionNote({
						ok: false,
						text: `"${file.name}" is not a .md file.`
					});
					return;
				}
				if (file.size > MAX_UPLOAD_BYTES) {
					setSkillActionNote({
						ok: false,
						text: `"${file.name}" is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB).`
					});
					return;
				}
				const content = await file.text();
				setSkillForm((current) => ({
					...current,
					sourceFile: {
						name: file.name,
						content
					}
				}));
				setSkillActionNote(null);
			};
			const handleClearSkillFile = () => {
				setSkillForm((current) => ({
					...current,
					sourceFile: null
				}));
			};
			const handleToggleSkill = async (name, modelInvocable, userInvocable) => {
				setToggling(name);
				setSkillActionNote(null);
				const outcome = await props.setSkillInvocable({
					name,
					modelInvocable,
					userInvocable
				});
				if (outcome.ok) {
					if (outcome.value.ok) setSkillActionNote({
						ok: true,
						text: `Updated ${name}`
					});
					else setSkillActionNote({
						ok: false,
						text: outcome.value.error
					});
				} else setSkillActionNote({
					ok: false,
					text: outcome.error
				});
				setToggling(null);
				refreshSkills();
			};
			const handleRemoveServer = async (id) => {
				const next = mcp.servers.filter((server) => server.id !== id);
				saveMcp(next);
			};
			const handleAddServer = async () => {
				const serverName = mcpDraft.serverName.trim();
				if (serverName === "") {
					setMcpActionNote({
						ok: false,
						text: "serverName is required ([A-Za-z0-9_-], max 32 chars)."
					});
					return;
				}
				if (mcp.servers.some((server) => server.serverName === serverName)) {
					setMcpActionNote({
						ok: false,
						text: `serverName "${serverName}" is already configured.`
					});
					return;
				}
				const next = {
					...mcpDraft,
					id: `dsh-mcp-manager-${serverName}`,
					serverName
				};
				saveMcp([...mcp.servers, next]);
			};
			const phaseBadge = (phase) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: {
					...styles.phaseBadge,
					color: PHASE_COLOR[phase],
					border: `1px solid ${PHASE_COLOR[phase]}`
				},
				children: PHASE_TEXT[phase]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: styles.title,
						children: "Skills & MCP Servers"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.tabs,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: tab === "skills" ? styles.tabActive : styles.tab,
							onClick: () => setTab("skills"),
							children: "Skills"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: tab === "mcp" ? styles.tabActive : styles.tab,
							onClick: () => setTab("mcp"),
							children: "MCP Servers"
						})]
					}),
					tab === "skills" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						"aria-label": "Skills",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.card,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: styles.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: {
											...styles.title,
											fontSize: "13.5px"
										},
										children: "Managed skills"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: styles.button,
										onClick: () => {
											refreshSkills();
										},
										disabled: skillsLoading,
										children: skillsLoading ? "Refreshing…" : "Refresh"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									style: styles.hint,
									children: [
										"Listed from ",
										skills.roots.length === 0 ? "the managed root" : skills.roots.map((root) => root.path).join(", "),
										". Adding writes a standard SKILL.md bundle the filesystem provider picks up automatically."
									]
								}),
								skillsError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.error,
									role: "status",
									children: skillsError
								}) : null,
								skillActionNote !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: skillActionNote.ok ? styles.notice : styles.error,
									role: "status",
									children: skillActionNote.text
								}) : null,
								skills.skills.length === 0 && skillsError === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.status,
									role: "status",
									children: "No skills found in the managed root yet."
								}) : null,
								skills.errors.length > 0 ? skills.errors.map((error) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.error,
									role: "status",
									children: error
								}, error)) : null,
								skills.skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: styles.item,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: styles.itemLine,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: styles.itemTitle,
													children: skill.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: styles.badge,
													children: skill.kind
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: styles.badge,
													children: skill.rootLabel
												})
											]
										}),
										skill.description !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: styles.hint,
											children: skill.description
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: styles.caption,
											children: skill.path
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: styles.itemLine,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												style: styles.switchRow,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: skill.modelInvocable,
													disabled: toggling === skill.name,
													onChange: (event) => void handleToggleSkill(skill.name, event.target.checked, skill.userInvocable)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: styles.hint,
													children: "Show to model"
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												style: styles.switchRow,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: skill.userInvocable,
													disabled: toggling === skill.name,
													onChange: (event) => void handleToggleSkill(skill.name, skill.modelInvocable, event.target.checked)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: styles.hint,
													children: "Show to user"
												})]
											})]
										})
									]
								}, skill.path))
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.card,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: {
										...styles.title,
										fontSize: "13.5px"
									},
									children: "Add skill"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: styles.fieldLabel,
									children: "Name (kebab-case)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: styles.input,
									"aria-label": "Skill name",
									value: skillForm.name,
									placeholder: "e.g. commit-message-review",
									onChange: (event) => setSkillForm((current) => ({
										...current,
										name: event.target.value
									})),
									spellCheck: false
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: styles.fieldLabel,
									children: "Description"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: styles.input,
									"aria-label": "Skill description",
									value: skillForm.description,
									placeholder: "One sentence: when to use this skill",
									onChange: (event) => setSkillForm((current) => ({
										...current,
										description: event.target.value
									}))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: styles.fieldLabel,
									children: "When to use (optional)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: styles.input,
									"aria-label": "When to use",
									value: skillForm.whenToUse,
									placeholder: "e.g. Always for pull request commits",
									onChange: (event) => setSkillForm((current) => ({
										...current,
										whenToUse: event.target.value
									}))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: styles.fieldLabel,
									children: "Upload a .md file (optional)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: styles.actions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											ref: fileInputRef,
											type: "file",
											accept: ".md,text/markdown,text/plain",
											style: { display: "none" },
											"aria-label": "Upload skill markdown file",
											onChange: (event) => {
												const file = event.target.files?.[0] ?? null;
												handlePickSkillFile(file);
												event.target.value = "";
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											onClick: () => fileInputRef.current?.click(),
											children: "Choose file…"
										}),
										skillForm.sourceFile !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: styles.status,
											children: skillForm.sourceFile.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											onClick: handleClearSkillFile,
											children: "Clear"
										})] }) : null
									]
								}),
								skillForm.sourceFile !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									style: styles.notice,
									children: [
										"The file's body and frontmatter (invocation flags, custom keys) are kept; name, description and ",
										`whenToUse`,
										" from the fields above take precedence."
									]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: styles.fieldLabel,
									children: "Instructions"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									style: {
										...styles.textarea,
										...skillForm.sourceFile !== null ? styles.disabled : {}
									},
									"aria-label": "Skill instructions",
									value: skillForm.body,
									disabled: skillForm.sourceFile !== null,
									placeholder: "## What this skill does\n\nStep-by-step instructions the model should follow…",
									onChange: (event) => setSkillForm((current) => ({
										...current,
										body: event.target.value
									}))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: styles.actions,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: styles.primaryButton,
										onClick: () => {
											handleAddSkill();
										},
										children: "Add skill"
									})
								})
							]
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						"aria-label": "MCP Servers",
						children: [
							!mcp.bridgeResolvable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: styles.card,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.error,
									role: "status",
									children: "The MCP client bridge (@deepseek-ai/dsh-mcp-client) does not resolve in this process. Install it into the profile (e.g. add \"@deepseek-ai/dsh-mcp-client\": \"0.1.1-rc.2\" to the profile's package.json and reinstall), then restart — saved servers otherwise fail to connect."
								})
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: styles.card,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: styles.row,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
											style: {
												...styles.title,
												fontSize: "13.5px"
											},
											children: "Configured MCP servers"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											onClick: () => {
												refreshMcp();
											},
											disabled: mcpLoading,
											children: mcpLoading ? "Refreshing…" : "Refresh"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										style: styles.hint,
										children: [
											"Saved into ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { fontFamily: MONOSPACE },
												children: "~/.dsh/cordis.patch.yml"
											}),
											" as one @deepseek-ai/dsh-mcp-client instance per server; DSH hot-reloads the file, so changes go live without a restart."
										]
									}),
									mcpError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: styles.error,
										role: "status",
										children: mcpError
									}) : null,
									mcpActionNote !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: mcpActionNote.ok ? styles.notice : styles.error,
										role: "status",
										children: mcpActionNote.text
									}) : null,
									mcp.warnings.map((warning) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: styles.notice,
										role: "status",
										children: warning
									}, warning)),
									mcp.live.length === 0 && mcpError === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: styles.status,
										role: "status",
										children: "No MCP servers are configured or running."
									}) : null,
									mcp.live.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: styles.item,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: styles.itemLine,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: styles.itemTitle,
														children: server.serverName
													}),
													phaseBadge(server.phase),
													server.managed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: styles.badge,
														children: "managed"
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: styles.badge,
														children: "external"
													}),
													!server.present ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: styles.badge,
														children: "pending apply"
													}) : null
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: styles.caption,
												children: server.id
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: styles.actions,
												children: server.managed || server.serverName !== "unknown" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													style: styles.dangerButton,
													disabled: saving,
													onClick: () => void handleRemoveServer(server.id),
													children: "Remove"
												}) : null
											})
										]
									}, `${server.id}-${server.present ? "live" : "cfg"}`))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: styles.card,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: {
											...styles.title,
											fontSize: "13.5px"
										},
										children: "Add server"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: styles.formGrid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "serverName (namespace)"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: styles.input,
											"aria-label": "serverName",
											value: mcpDraft.serverName,
											placeholder: "e.g. github",
											spellCheck: false,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												serverName: event.target.value
											}))
										})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Transport"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											style: styles.input,
											"aria-label": "Transport",
											value: mcpDraft.transport,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												transport: event.target.value === "stdio" ? "stdio" : "streamable-http"
											})),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "stdio",
												children: "stdio"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "streamable-http",
												children: "streamable-http"
											})]
										})] })]
									}),
									mcpDraft.transport === "stdio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Command"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: styles.input,
											"aria-label": "Command",
											value: mcpDraft.command,
											placeholder: "e.g. npx",
											spellCheck: false,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												command: event.target.value
											}))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Arguments (one per line)"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											style: {
												...styles.textarea,
												minHeight: "64px"
											},
											"aria-label": "Arguments",
											value: mcpDraft.args.join("\n"),
											placeholder: "-y\n@modelcontextprotocol/server-github",
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												args: event.target.value.split("\n").filter((line) => line.trim() !== "")
											}))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Environment (KEY=value, one per line)"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											style: {
												...styles.textarea,
												minHeight: "64px"
											},
											"aria-label": "Environment",
											value: Object.entries(mcpDraft.env).map(([key, value]) => `${key}=${value}`).join("\n"),
											placeholder: "GITHUB_TOKEN=ghp_…",
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												env: parseKeyValueLines(event.target.value)
											}))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Working directory (optional)"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: styles.input,
											"aria-label": "Working directory",
											value: mcpDraft.cwd,
											placeholder: "",
											spellCheck: false,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												cwd: event.target.value
											}))
										})
									] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "URL"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: styles.input,
											"aria-label": "URL",
											value: mcpDraft.url,
											placeholder: "https://example.com/mcp",
											spellCheck: false,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												url: event.target.value
											}))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											style: styles.fieldLabel,
											children: "Headers (KEY=value, one per line)"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											style: {
												...styles.textarea,
												minHeight: "64px"
											},
											"aria-label": "Headers",
											value: Object.entries(mcpDraft.headers).map(([key, value]) => `${key}=${value}`).join("\n"),
											placeholder: "Authorization=Bearer …",
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												headers: parseKeyValueLines(event.target.value)
											}))
										})
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: styles.switchRow,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: mcpDraft.failOnStartupError,
											onChange: (event) => setMcpDraft((current) => ({
												...current,
												failOnStartupError: event.target.checked
											}))
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: styles.hint,
											children: "Fail activation when the initial connect/sync fails"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: styles.actions,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: saving ? {
												...styles.primaryButton,
												...styles.disabled
											} : styles.primaryButton,
											disabled: saving,
											onClick: () => {
												handleAddServer();
											},
											children: saving ? "Saving…" : "Add server"
										})
									})
								]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/shared/remote.ts
		/** Cordis service key of the receiver, also the wire namespace. */
		const SERVICE = "skillMcpManager";
		const PREFIX = `dsh-skill-mcp-manager#${SERVICE}.`;
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
		}
		function isString(value) {
			return typeof value === "string";
		}
		function isBoolean(value) {
			return typeof value === "boolean";
		}
		function isStringArray(value) {
			return Array.isArray(value) && value.every(isString);
		}
		function isStringDict(value) {
			if (!isRecord(value)) return false;
			return Object.values(value).every(isString);
		}
		function parseSkillView(value) {
			if (!isRecord(value)) throw new TypeError("skill must be a plain object");
			const { name, description, root, rootLabel, kind, path, modelInvocable, userInvocable } = value;
			if (!isString(name) || !isString(description) || !isString(root) || !isString(rootLabel) || !isString(path) || kind !== "bundle" && kind !== "flat" || !isBoolean(modelInvocable) || !isBoolean(userInvocable)) throw new TypeError("skill has invalid fields");
			return {
				name,
				description,
				root,
				rootLabel,
				kind: kind === "bundle" ? "bundle" : "flat",
				path,
				modelInvocable,
				userInvocable
			};
		}
		function parseSkillRoot(value) {
			if (!isRecord(value) || !isString(value.name) || !isString(value.path)) throw new TypeError("skill root must have string name and path");
			return {
				name: value.name,
				path: value.path
			};
		}
		/** Predicate form: true when {@link parseSkillView} accepts the value. */
		function acceptsSkillView(value) {
			try {
				parseSkillView(value);
				return true;
			} catch {
				return false;
			}
		}
		/** Predicate form: true when {@link parseSkillRoot} accepts the value. */
		function acceptsSkillRoot(value) {
			try {
				parseSkillRoot(value);
				return true;
			} catch {
				return false;
			}
		}
		function parseSkillsSnapshot(value) {
			if (!isRecord(value)) throw new TypeError("skills snapshot must be a plain object");
			const { roots, skills, errors } = value;
			if (!Array.isArray(roots) || !roots.every(acceptsSkillRoot)) throw new TypeError("skills snapshot roots must be an array of skill roots");
			if (!Array.isArray(skills) || !skills.every(acceptsSkillView)) throw new TypeError("skills snapshot skills must be an array of skills");
			if (!isStringArray(errors)) throw new TypeError("skills snapshot errors must be an array of strings");
			return {
				roots,
				skills,
				errors
			};
		}
		function parseMcpServerDefinition(value) {
			if (!isRecord(value)) throw new TypeError("mcp server must be a plain object");
			const { id, serverName, transport, command, args, env, cwd, url, headers, toolCallTimeoutMs, failOnStartupError } = value;
			if (!isString(id) || !isString(serverName) || transport !== "stdio" && transport !== "streamable-http" || !isString(command) || !isStringArray(args) || !isStringDict(env) || !isString(cwd) || !isString(url) || !isStringDict(headers) || typeof toolCallTimeoutMs !== "number" || !Number.isFinite(toolCallTimeoutMs) || !isBoolean(failOnStartupError)) throw new TypeError("mcp server has invalid fields");
			return {
				id,
				serverName,
				transport: transport === "stdio" ? "stdio" : "streamable-http",
				command,
				args,
				env,
				cwd,
				url,
				headers,
				toolCallTimeoutMs,
				failOnStartupError
			};
		}
		/** Predicate form: true when {@link parseMcpServerDefinition} accepts the value. */
		function acceptsMcpServer(value) {
			try {
				parseMcpServerDefinition(value);
				return true;
			} catch {
				return false;
			}
		}
		function parseMcpSnapshot(value) {
			if (!isRecord(value)) throw new TypeError("mcp snapshot must be a plain object");
			const { servers, live, bridgeResolvable, patchPath, warnings } = value;
			if (!Array.isArray(servers) || !servers.every(acceptsMcpServer)) throw new TypeError("mcp snapshot servers must be an array of mcp server definitions");
			if (!isBoolean(bridgeResolvable) || !isString(patchPath) || !isStringArray(warnings)) throw new TypeError("mcp snapshot has invalid scalar fields");
			return {
				servers,
				live: (live ?? []).map((entry, index) => {
					if (!isRecord(entry) || !isString(entry.id) || !isString(entry.serverName) || entry.phase !== "active" && entry.phase !== "pending" && entry.phase !== "failed" && entry.phase !== "unknown" || !isBoolean(entry.managed) || !isBoolean(entry.present)) throw new TypeError(`mcp live entry ${String(index)} has invalid fields`);
					return {
						id: entry.id,
						serverName: entry.serverName,
						phase: entry.phase,
						managed: entry.managed,
						present: entry.present
					};
				}),
				bridgeResolvable,
				patchPath,
				warnings
			};
		}
		function parseSkillMutationOutcome(value) {
			if (!isRecord(value) || !isBoolean(value.ok)) throw new TypeError("skill mutation outcome must be a plain object with ok");
			if (value.ok) {
				if (!isString(value.path)) throw new TypeError("skill mutation outcome ok result must carry a string path");
				return {
					ok: true,
					path: value.path
				};
			}
			if (!isString(value.error)) throw new TypeError("skill mutation outcome error must be a string");
			return {
				ok: false,
				error: value.error
			};
		}
		function parseMcpSaveOutcome(value) {
			if (!isRecord(value) || !isBoolean(value.ok)) throw new TypeError("mcp save outcome must be a plain object with ok");
			if (value.ok) {
				if (!isBoolean(value.saved) || !isBoolean(value.applied) || !isString(value.patchPath)) throw new TypeError("mcp save outcome ok result has invalid fields");
				return {
					ok: true,
					saved: value.saved,
					applied: value.applied,
					patchPath: value.patchPath
				};
			}
			if (!isString(value.error)) throw new TypeError("mcp save outcome error must be a string");
			return {
				ok: false,
				error: value.error
			};
		}
		function parseAddSkillInput(value) {
			if (!isRecord(value)) throw new TypeError("add-skill input must be a plain object");
			const { name, description, body, whenToUse, sourceFile } = value;
			if (!isString(name) || !isString(description) || !isString(body)) throw new TypeError("add-skill input name, description and body must be strings");
			const optional = {};
			if (whenToUse !== void 0) {
				if (!isString(whenToUse)) throw new TypeError("add-skill input whenToUse must be a string");
				optional.whenToUse = whenToUse;
			}
			if (sourceFile !== void 0) {
				if (!isRecord(sourceFile) || !isString(sourceFile.name) || !isString(sourceFile.content)) throw new TypeError("add-skill input sourceFile must be an object with string name and content");
				optional.sourceFile = {
					name: sourceFile.name,
					content: sourceFile.content
				};
			}
			return {
				name,
				description,
				body,
				...optional
			};
		}
		function parseSetSkillInvocableInput(value) {
			if (!isRecord(value) || !isString(value.name) || !isBoolean(value.modelInvocable) || !isBoolean(value.userInvocable)) throw new TypeError("set-skill-invocable input must be a plain object with name and two booleans");
			return {
				name: value.name,
				modelInvocable: value.modelInvocable,
				userInvocable: value.userInvocable
			};
		}
		function parseMcpServerList(value) {
			if (!Array.isArray(value) || !value.every(acceptsMcpServer)) throw new TypeError("servers must be an array of mcp server definitions");
			return value;
		}
		const SKILLS_SNAPSHOT_SCHEMA = { parse: parseSkillsSnapshot };
		const SKILL_MUTATION_SCHEMA = { parse: parseSkillMutationOutcome };
		const MCP_SNAPSHOT_SCHEMA = { parse: parseMcpSnapshot };
		const MCP_SAVE_SCHEMA = { parse: parseMcpSaveOutcome };
		/** The one descriptor each method needs: generated-style identity + strict codecs. */
		function descriptor(method, parameters, result) {
			return {
				id: `${PREFIX}${method}`,
				service: SERVICE,
				namespace: SERVICE,
				method,
				invocation: { kind: "direct" },
				parameters,
				result: {
					mode: "strict",
					typeSymbol: `dsh-skill-mcp-manager#${method}`,
					schema: result
				}
			};
		}
		const DESCRIPTORS = [
			descriptor("listSkills", [], SKILLS_SNAPSHOT_SCHEMA),
			descriptor("addSkill", [{
				name: "input",
				wire: "input",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-skill-mcp-manager#AddSkillInput",
					schema: { parse: parseAddSkillInput }
				}
			}], SKILL_MUTATION_SCHEMA),
			descriptor("setSkillInvocable", [{
				name: "input",
				wire: "input",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-skill-mcp-manager#SetSkillInvocableInput",
					schema: { parse: parseSetSkillInvocableInput }
				}
			}], SKILL_MUTATION_SCHEMA),
			descriptor("listMcpServers", [], MCP_SNAPSHOT_SCHEMA),
			descriptor("saveMcpServers", [{
				name: "servers",
				wire: "servers",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-skill-mcp-manager#McpServerList",
					schema: { parse: parseMcpServerList }
				}
			}], MCP_SAVE_SCHEMA)
		];
		//#endregion
		//#region src/client/index.ts
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "remote"];
		/**
		* Register the Settings section for the skill & MCP manager.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const mount = ctx.remote.$mount({
				package: "dsh-skill-mcp-manager",
				descriptors: [...DESCRIPTORS]
			});
			mount.catch(() => {});
			/** Call one Remote method, surfacing mount/transport failures as outcomes. */
			const call = async (method, ...args) => {
				try {
					await mount;
					const namespace = ctx.get(`remote.${SERVICE}`);
					if (namespace === void 0) return {
						ok: false,
						error: "Skill & MCP Manager is unavailable — the remote is not mounted."
					};
					const result = await method(namespace)(...args);
					if (result.ok) return {
						ok: true,
						value: result.value
					};
					return {
						ok: false,
						error: `${result.error.message} (${result.error.code})`
					};
				} catch (error) {
					return {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const injected = {
				listSkills: () => call((ns) => ns.listSkills.bind(ns)),
				addSkill: (input) => call((ns) => ns.addSkill.bind(ns), input),
				setSkillInvocable: (input) => call((ns) => ns.setSkillInvocable.bind(ns), input),
				listMcpServers: () => call((ns) => ns.listMcpServers.bind(ns)),
				saveMcpServers: (servers) => call((ns) => ns.saveMcpServers.bind(ns), servers)
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skill-mcp-manager",
				order: 300,
				label: "Skills & MCP",
				inject: () => ({ ...injected })
			}, SkillMcpManagerPanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map