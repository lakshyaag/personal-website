"use client";
import { SOCIAL_LINKS } from "@/lib/data/social";
import Link from "next/link";

export function Header() {
	return (
		<header className="mb-8 flex items-start justify-between">
			<div>
				<Link
					href="/"
					className="font-medium text-2xl text-black dark:text-white"
				>
					Lakshya Agarwal
				</Link>
				<p>
					Engineer by curiosity,{" "}
					<a
						className="font-base group relative inline-block font-[450] text-zinc-900 dark:text-zinc-50 underline"
						href="https://en.wikipedia.org/wiki/Philomath"
						target="_blank"
						rel="noopener noreferrer"
					>
						philomath
					</a>{" "}
					by nature
				</p>
			</div>

			<div className="hidden sm:flex flex-col items-end space-y-0.5">
				<Link
					href="/airports"
					className="underline underline-offset-1 text-zinc-800 hover:text-zinc-600 dark:text-zinc-200 dark:hover:text-zinc-400 transition-colors"
				>
					Airports
				</Link>
				{SOCIAL_LINKS.filter((link) => link.showHeader).map((link) => (
					<Link
						key={link.label}
						href={link.link}
						className="underline underline-offset-1 text-zinc-800 hover:text-zinc-600 dark:text-zinc-200 dark:hover:text-zinc-400 transition-colors"
						target="_blank"
						rel="noopener noreferrer"
					>
						{link.label}
					</Link>
				))}
			</div>
		</header>
	);
}
