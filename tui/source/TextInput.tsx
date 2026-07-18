import React, {useState, useEffect} from 'react';
import {Text, useInput} from 'ink';
import chalk from 'chalk';

type Props = {
	value: string;
	placeholder?: string;
	focus?: boolean;
	mask?: string;
	showCursor?: boolean;
	onChange: (value: string) => void;
	onSubmit?: (value: string) => void;
};

function prevWordBoundary(s: string, pos: number): number {
	let i = pos;
	while (i > 0 && !/\w/.test(s[i - 1]!)) i--;
	while (i > 0 && /\w/.test(s[i - 1]!)) i--;
	return i;
}

function nextWordBoundary(s: string, pos: number): number {
	let i = pos;
	while (i < s.length && !/\w/.test(s[i]!)) i++;
	while (i < s.length && /\w/.test(s[i]!)) i++;
	return i;
}

export default function TextInput({
	value: originalValue,
	placeholder = '',
	focus = true,
	mask,
	showCursor = true,
	onChange,
	onSubmit,
}: Props) {
	const [cursorOffset, setCursorOffset] = useState((originalValue || '').length);

	useEffect(() => {
		if (!focus || !showCursor) return;
		setCursorOffset(prev => (prev > originalValue.length ? originalValue.length : prev));
	}, [originalValue, focus, showCursor]);

	const value = mask ? mask.repeat(originalValue.length) : originalValue;

	let renderedValue = value;
	let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
				: chalk.inverse(' ');

		renderedValue = value.length > 0 ? '' : chalk.inverse(' ');
		let i = 0;
		for (const char of value) {
			renderedValue += i === cursorOffset ? chalk.inverse(char) : char;
			i++;
		}
		if (value.length > 0 && cursorOffset === value.length) {
			renderedValue += chalk.inverse(' ');
		}
	}

	useInput(
		(input, key) => {
			if (
				key.upArrow ||
				key.downArrow ||
				(key.ctrl && input === 'c') ||
				key.tab ||
				(key.shift && key.tab)
			)
				return;

			if (key.return) {
				onSubmit?.(originalValue);
				return;
			}

			let nextCursor = cursorOffset;
			let nextValue = originalValue;

			if (key.leftArrow && key.meta) {
				nextCursor = prevWordBoundary(originalValue, cursorOffset);
			} else if (key.rightArrow && key.meta) {
				nextCursor = nextWordBoundary(originalValue, cursorOffset);
			} else if (key.leftArrow && key.ctrl) {
				nextCursor = prevWordBoundary(originalValue, cursorOffset);
			} else if (key.rightArrow && key.ctrl) {
				nextCursor = nextWordBoundary(originalValue, cursorOffset);
			} else if (key.leftArrow) {
				nextCursor = Math.max(0, cursorOffset - 1);
			} else if (key.rightArrow) {
				nextCursor = Math.min(originalValue.length, cursorOffset + 1);
			} else if (key.ctrl && input === 'a') {
				nextCursor = 0;
			} else if (key.ctrl && input === 'e') {
				nextCursor = originalValue.length;
			} else if (key.ctrl && input === 'k') {
				nextValue = originalValue.slice(0, cursorOffset);
			} else if (key.ctrl && input === 'u') {
				nextValue = originalValue.slice(cursorOffset);
				nextCursor = 0;
			} else if ((key.ctrl && input === 'w') || (key.meta && key.backspace)) {
				const boundary = prevWordBoundary(originalValue, cursorOffset);
				nextValue = originalValue.slice(0, boundary) + originalValue.slice(cursorOffset);
				nextCursor = boundary;
			} else if (key.backspace || key.delete) {
				if (cursorOffset > 0) {
					nextValue =
						originalValue.slice(0, cursorOffset - 1) + originalValue.slice(cursorOffset);
					nextCursor = cursorOffset - 1;
				}
			} else if (input) {
				nextValue =
					originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset);
				nextCursor = cursorOffset + input.length;
			}

			nextCursor = Math.max(0, Math.min(nextCursor, nextValue.length));
			setCursorOffset(nextCursor);
			if (nextValue !== originalValue) onChange(nextValue);
		},
		{isActive: focus},
	);

	return (
		<Text>
			{placeholder
				? originalValue.length > 0
					? renderedValue
					: renderedPlaceholder
				: renderedValue}
		</Text>
	);
}

export function UncontrolledTextInput({
	initialValue = '',
	...props
}: Omit<Props, 'value' | 'onChange'> & {initialValue?: string}) {
	const [value, setValue] = useState(initialValue);
	return <TextInput {...props} value={value} onChange={setValue} />;
}
