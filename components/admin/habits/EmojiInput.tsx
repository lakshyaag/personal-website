"use client";

import { useId, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { Smile } from "lucide-react";
import useClickOutside from "@/hooks/useClickOutside";

const EmojiPicker = dynamic(
	() => import("emoji-picker-react").then((mod) => mod.default),
	{ ssr: false },
);

const INPUT_CLASSES =
	"rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const LABEL_CLASSES =
	"mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

interface EmojiInputProps {
	id?: string;
	label?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

/**
 * Emoji input: text field (so on mobile, focusing opens keyboard with native emoji picker)
 * plus an optional "Pick" button that opens the emoji-picker-react panel for browsing.
 */
export function EmojiInput({
	id: idProp,
	label = "Emoji (optional)",
	value,
	onChange,
	placeholder = "Tap to type or paste — use keyboard emoji on mobile",
}: EmojiInputProps) {
	const inputId = idProp ?? useId();
	const containerRef = useRef<HTMLDivElement>(null);
	const [pickerOpen, setPickerOpen] = useState(false);

	useClickOutside(containerRef, useCallback(() => {
		setPickerOpen(false);
	}, []));

	const handleEmojiClick = useCallback(
		(emojiData: { emoji: string }) => {
			onChange(emojiData.emoji);
			setPickerOpen(false);
		},
		[onChange],
	);

	const isDark =
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark");

	return (
		<div ref={containerRef} className="relative">
			{label && (
				<label htmlFor={inputId} className={LABEL_CLASSES}>
					{label}
				</label>
			)}
			<div className="flex gap-2">
				<input
					id={inputId}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className={`${INPUT_CLASSES} flex-1 min-w-0`}
					autoComplete="off"
				/>
				<button
					type="button"
					onClick={() => setPickerOpen((open) => !open)}
					className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
					title="Pick emoji"
					aria-label="Open emoji picker"
				>
					<Smile size={20} />
				</button>
			</div>
			{pickerOpen && (
				<div className="absolute z-50 mt-2 [&_.epr-main]:!rounded-lg [&_.epr-main]:!border [&_.epr-main]:!border-zinc-200 [&_.epr-main]:!dark:border-zinc-700">
					<EmojiPicker
						onEmojiClick={handleEmojiClick}
						theme={isDark ? Theme.DARK : Theme.LIGHT}
						width={320}
						height={360}
					/>
				</div>
			)}
		</div>
	);
}
