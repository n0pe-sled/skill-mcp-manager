/**
 * Shell-word tokenizing for pasted command lines.
 *
 * When a user pastes a full command (`npx -y @modelcontextprotocol/server-github`)
 * into the Command field — or a multi-token string into one argument row — the
 * UI splits it into the tokens it would have as argv. This module is that
 * splitter: POSIX-ish word splitting with single-quote, double-quote, and
 * backslash support, matching how a shell would hand argv to a process.
 *
 * Deliberately not a full shell parser: no variable expansion, no operators
 * (`|`, `&&`, redirects). Operators are tokenized as plain words — good enough
 * for pasting the command lines MCP server READMEs ship, and never wrong in a
 * dangerous way (the parts still land in visible, editable rows).
 *
 * @module dsh-skill-mcp-manager/shlex
 */

/**
 * Split `text` into shell-style words.
 *
 * - Words separate on whitespace (spaces, tabs, newlines).
 * - `'…'` and `"…"` group content into one word; the surrounding quotes are
 *   stripped, so `--flag="a b"` becomes the single argument `--flag=a b`.
 * - `\x` escapes the next character outside quotes (and `\'`/`\"`/`\\` inside
 *   quotes); a trailing backslash is literal.
 * - An unterminated quote takes the literal remainder of the line — a pasted
   fragment should never silently discard text.
 */
export function splitCommandLine(text: string): string[] {
  const out: string[] = []
  let current = ''
  let started = false

  const push = (): void => {
    // A word with only escapes/quotes still counts once it opened ("''" is a
    // real empty argument); whitespace between words does not.
    if (started) out.push(current)
    current = ''
    started = false
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      push()
      continue
    }
    if (char === "'") {
      started = true
      const end = text.indexOf("'", i + 1)
      if (end === -1) {
        current += text.slice(i + 1)
        i = text.length
        break
      }
      current += text.slice(i + 1, end)
      i = end
      continue
    }
    if (char === '"') {
      started = true
      let j = i + 1
      let closed = false
      while (j < text.length) {
        if (text[j] === '\\' && (text[j + 1] === '"' || text[j + 1] === '\\')) {
          current += text[j + 1]
          j += 2
          continue
        }
        if (text[j] === '"') {
          closed = true
          break
        }
        current += text[j]
        j += 1
      }
      if (!closed) {
        // Unterminated: keep the literal remainder (without the opening quote).
        i = text.length
        break
      }
      i = j
      continue
    }
    if (char === '\\' && i + 1 < text.length) {
      started = true
      current += text[i + 1]
      i += 1
      continue
    }
    started = true
    current += char
  }
  push()
  return out
}
