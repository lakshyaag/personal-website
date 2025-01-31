import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center h-screen gap-8">
			<h2 className="text-2xl font-bold">Not Found</h2>
			<p className="text-zinc-500 dark:text-zinc-400">
				Uh... this page doesn't exist (yet?)
			</p>
			<Link href="/" className="text-zinc-500 dark:text-zinc-400 underline">
				Return Home
			</Link>
		</div>
	);
}
