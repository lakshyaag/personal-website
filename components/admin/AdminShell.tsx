"use client";

import {
	BookOpen,
	Dumbbell,
	Ellipsis,
	House,
	Images,
	LogOut,
	NotebookPen,
	Plane,
	Utensils,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet } from "./kit";

const primary = [
	{ href: "/admin/journal", label: "Journal", icon: NotebookPen },
	{ href: "/admin/food", label: "Food", icon: Utensils },
	{ href: "/admin/workouts", label: "Workouts", icon: Dumbbell },
	{ href: "/admin/photos", label: "Photos", icon: Images },
];
const secondary = [
	{ href: "/admin/books", label: "Books", icon: BookOpen },
	{ href: "/admin/airports", label: "Airports", icon: Plane },
];

/** Tab bar on phones, top bar on larger screens. Every admin page renders inside it. */
export function AdminShell({
	children,
	signOut,
}: {
	children: React.ReactNode;
	signOut: () => Promise<void>;
}) {
	const path = usePathname();
	const [more, setMore] = useState(false);
	const active = (href: string) => path === href || path.startsWith(`${href}/`);
	const moreActive = secondary.some((item) => active(item.href));
	return (
		<div className="min-h-dvh">
			<header className="sticky top-0 z-30 hidden border-b border-zinc-200 bg-white/90 backdrop-blur sm:block dark:border-zinc-800 dark:bg-zinc-950/90">
				<nav className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
					{[...primary, ...secondary].map((item) => (
						<Link
							key={item.href}
							href={item.href}
							aria-current={active(item.href) ? "page" : undefined}
							className={`rounded-lg px-3 py-2 text-sm font-medium ${
								active(item.href)
									? "bg-zinc-100 dark:bg-zinc-800"
									: "text-zinc-600 dark:text-zinc-400"
							}`}
						>
							{item.label}
						</Link>
					))}
					<Link
						href="/"
						className="ml-auto rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400"
					>
						View site
					</Link>
					<form action={signOut}>
						<button
							type="submit"
							className="rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400"
						>
							Sign out
						</button>
					</form>
				</nav>
			</header>
			<main className="mx-auto max-w-3xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pt-8 sm:pb-24">
				{children}
			</main>
			<nav
				aria-label="Admin"
				className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
			>
				<ul className="grid grid-cols-5">
					{primary.map((item) => (
						<li key={item.href}>
							<Link
								href={item.href}
								aria-current={active(item.href) ? "page" : undefined}
								className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
									active(item.href)
										? "text-zinc-900 dark:text-zinc-50"
										: "text-zinc-500"
								}`}
							>
								<item.icon className="h-5 w-5" />
								{item.label}
							</Link>
						</li>
					))}
					<li>
						<button
							type="button"
							onClick={() => setMore(true)}
							className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
								moreActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
							}`}
						>
							<Ellipsis className="h-5 w-5" />
							More
						</button>
					</li>
				</ul>
			</nav>
			<Sheet open={more} onClose={() => setMore(false)} title="More">
				<ul className="space-y-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
					{secondary.map((item) => (
						<li key={item.href}>
							<Link
								href={item.href}
								onClick={() => setMore(false)}
								className="flex items-center gap-3 rounded-lg px-3 py-3 text-base"
							>
								<item.icon className="h-5 w-5" />
								{item.label}
							</Link>
						</li>
					))}
					<li>
						<Link
							href="/"
							onClick={() => setMore(false)}
							className="flex items-center gap-3 rounded-lg px-3 py-3 text-base"
						>
							<House className="h-5 w-5" />
							View site
						</Link>
					</li>
					<li>
						<form action={signOut}>
							<button
								type="submit"
								className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base text-zinc-600 dark:text-zinc-400"
							>
								<LogOut className="h-5 w-5" />
								Sign out
							</button>
						</form>
					</li>
				</ul>
			</Sheet>
		</div>
	);
}
