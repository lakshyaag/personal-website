"use client";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { TableOfContents } from "@/components/TableOfContents";
import { BLOG_POSTS } from "@/lib/data/blogs";
import { formatDate } from "@/lib/date-utils";
import "katex/dist/katex.min.css";
import "@/lib/styles/tokyo-night-dark.css";
import { usePathname, useRouter } from "next/navigation";

export default function LayoutBlogPost({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const post = BLOG_POSTS.find((p) => p.link === pathname);

	return (
		<>
			<div className="pointer-events-none fixed left-0 top-0 z-10 h-12 w-full bg-gray-100 to-transparent backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] dark:bg-zinc-950" />
			<ScrollProgress
				className="fixed top-0 z-20 h-0.5 bg-gray-300 dark:bg-zinc-600"
				springOptions={{
					bounce: 0,
				}}
			/>
			<button
				type="button"
				onClick={() => router.push("/blogs")}
				className="fixed top-4 left-4 z-30 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors"
			>
				← Back
			</button>
			<TableOfContents />
			<main className="prose prose-gray max-w-none mt-24 pb-20 prose-h4:prose-base dark:prose-invert prose-h1:text-xl prose-h1:font-medium prose-h2:mt-12 prose-h2:scroll-m-20 prose-h2:text-lg prose-h2:font-medium prose-h3:text-base prose-h3:font-medium prose-h4:font-medium prose-h5:text-base prose-h5:font-medium prose-h6:text-base prose-h6:font-medium">
				{post && (
					<div className="not-prose -mt-4 mb-8 flex justify-end border-b border-zinc-200 pb-4 dark:border-zinc-800">
						<time
							dateTime={post.date}
							className="text-sm text-zinc-500 dark:text-zinc-400"
						>
							{formatDate(post.date, {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}
						</time>
					</div>
				)}
				{children}
			</main>
		</>
	);
}
