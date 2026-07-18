// Theme system. Ink has no built-in theming, so we define a small set of semantic
// color roles and a few palettes, expose the active theme via React context, and let
// screens read roles with useTheme(). Body text stays terminal-default (adapts to the
// user's terminal); the theme drives accents, structure, and status colors.
//
// Role guide — what each color is used for:
//   accent  brand/primary: "// clpr", active nav, selected item, arrows, progress,
//           pass/summited, spinners, gist active tab, comment author.
//   muted   structure/secondary: tree connectors, "// section" labels, inactive nav,
//           table headers, hints, timestamps.
//   warn    attention: locked notices, read-only banner, transient messages, lock icon.
//   crit    errors and failed checks.
//   info    neutral highlight: coming-soon icon, misc accents.
//
// Icons use Nerd Font glyphs (like oh-my-zsh); a Nerd Font must be installed to see
// them. Carets are plain unicode so folding works even without one.

import {createContext, useContext} from 'react';

export type Theme = {
	name: string;
	accent: string;
	muted: string;
	warn: string;
	crit: string;
	info: string;
};

export const THEMES: Record<string, Theme> = {
	catppuccin: {
		name: 'catppuccin',
		accent: '#a6e3a1',
		muted: '#6c7086',
		warn: '#f9e2af',
		crit: '#f38ba8',
		info: '#89b4fa',
	},
	'tokyo-night': {
		name: 'tokyo-night',
		accent: '#9ece6a',
		muted: '#565f89',
		warn: '#e0af68',
		crit: '#f7768e',
		info: '#7aa2f7',
	},
	'ayu-dark': {
		name: 'ayu-dark',
		accent: '#aad94c',
		muted: '#565b66',
		warn: '#ffb454',
		crit: '#f07178',
		info: '#59c2ff',
	},
};

export const THEME_ORDER = ['catppuccin', 'tokyo-night', 'ayu-dark'];
export const DEFAULT_THEME = 'catppuccin';

export function resolveTheme(name?: string): Theme {
	return THEMES[name ?? ''] ?? THEMES[DEFAULT_THEME]!;
}

export function nextTheme(name: string): string {
	const i = THEME_ORDER.indexOf(name);
	return THEME_ORDER[(i + 1) % THEME_ORDER.length]!;
}

// Nerd Font glyphs (oh-my-zsh style). Colored via roles at the call site.
export const ICON = {
	lock: '',
	soon: '',
	check: '',
	quiz: '\uf11e',
	caretOpen: '▾',
	caretClosed: '▸',
	arrow: '->',
	pointer: '❯',
	streak: '\uf06d',
};

export const ThemeContext = createContext<Theme>(THEMES[DEFAULT_THEME]!);
export const useTheme = () => useContext(ThemeContext);
