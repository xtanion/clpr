// Up/down list selection with clamping, driven by Ink's useInput.

import {useState} from 'react';
import {useInput} from 'ink';

export function useList(length: number, active = true): number {
	const [index, setIndex] = useState(0);
	useInput(
		(_input, key) => {
			if (length === 0) return;
			if (key.upArrow) setIndex(i => (i - 1 + length) % length);
			if (key.downArrow) setIndex(i => (i + 1) % length);
		},
		{isActive: active},
	);
	return Math.min(index, Math.max(0, length - 1));
}
