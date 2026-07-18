# clpr (terminal client)

A real terminal UI for the clpr learning tracker — the actual TUI the web frontend
imitates. Built with [Ink](https://github.com/vadimdemedes/ink) (React for the
terminal), so it mirrors the web app's React model, uses the terminal's own **ANSI
palette**, and paints **no background** (your terminal's background shows through).

## Setup

```sh
cd tui
npm install
npm link      # builds (via prepare) and installs `clpr` on your PATH
```

`npm link` is all you need — it runs the build and puts a single `clpr` command on your
PATH. Everything below is driven by that one command.

Point it at your backend and set the shared API key (matches `BACKEND_API_KEY` on the
server; leave empty if the gate is disabled):

```sh
clpr configure --base-url http://127.0.0.1:8000 --api-key <BACKEND_API_KEY>
# or export CLPR_BASE_URL / CLPR_API_KEY
```

## Sign in (device flow)

```sh
clpr login     # prints a code, opens the browser approval page (/device)
clpr whoami
clpr logout
```

`login` starts a device-authorization request, opens `<app>/device?code=XXXX-XXXX` in
your browser (sign in with Google/GitHub if needed), and on approval stores a personal
bearer token at `~/.config/clpr/config.json` (mode `0600`). The web app must be running
to serve the approval page.

## Run

```sh
clpr               # launch the TUI
# or, during development (needs esbuild scripts approved):
npm run dev
```

Runs fullscreen (alternate screen buffer); your shell is restored on exit.

Nav: `1` blueprints · `2` board · `3` notes · `4` dashboard · `esc` back · `t` theme ·
`q` quit. Arrow keys move within a screen, `enter` selects. Climb isn't a tab — open it
by selecting a camp in the roadmap tree; use `enter`/`space` on a section to fold/unfold
it. In climb, `space`/`enter` toggles a topic, `g` opens the gist, `c` adds a comment.

Check-ins are automatic: finishing a read (marking a topic done) checks you in for today,
with minutes auto-tracked from your clpr usage (stored in `usage.json`, shown as
"N min today" on the dashboard). You never have to check in manually — but you can press
`e` on the dashboard to add an optional one-line summary for the day.

## Themes

Three built-in themes — `catppuccin` (default), `tokyo-night`, `ayu-dark`. Press `t` to
cycle (persisted to config), or set `CLPR_THEME` / `theme` in config. Colors are applied
by semantic role (accent / muted / warn / crit / info — see the role guide in
`source/theme.ts`); body text stays terminal-default so it adapts to your terminal.

Icons (lock, coming-soon, carets) use **Nerd Font** glyphs like oh-my-zsh — install a
Nerd Font and select it in your terminal, or they'll show as missing-glyph boxes.

Without a token the client runs read-only (roadmap + public content); state screens
prompt you to log in.

## Parity notes vs the web app

- **`code` quiz questions** open your `$EDITOR` to write a multi-line function (with your
  editor's own syntax highlighting), then run it against the hidden tests in-process with
  `new Function` — the same grading the web uses in-browser.
- **Markdown** (gists, journal notes) is rendered by a small theme-aware renderer, so
  headings/code/tables use the active theme's colors; mermaid fences show as plain code.
- **3D garage room** → ASCII materials/artifacts inventory.
- **3D activity board** → 2D check-in heatmap.
- **Mermaid diagrams in gists** → rendered as plain (muted) code blocks; no diagram engine.

## Layout

`source/cli.tsx` (entry + subcommands) · `app.tsx` (shell, nav, data load) ·
`api.ts` / `config.ts` / `auth.ts` · `state.ts` (selectors ported from the web store) ·
`grade.ts` (quiz grading ported from the web) · `screens/*` (one per view).
