import { Tweet } from "react-tweet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { MDXComponents } from "mdx/types";
import type { Components } from "react-markdown";
import { ImageCarousel } from "./components/ImageCarousel";

// Shared styles and constants
const styles = {
	column: "flex flex-col",
	content:
		"flex-1 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700",
	prose: "prose prose-sm dark:prose-invert max-w-none",
	heading: "text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3",
	container: "my-6",
	grid: "grid grid-cols-1 md:grid-cols-2 gap-6",
} as const;

// Shared markdown component overrides for consistent styling
const markdownComponents = {
	p: ({ children }: { children: React.ReactNode }) => (
		<p className="mb-3 last:mb-0">{children}</p>
	),
	ul: ({ children }: { children: React.ReactNode }) => (
		<ul className="mb-3 last:mb-0 ml-4 list-disc">{children}</ul>
	),
	ol: ({ children }: { children: React.ReactNode }) => (
		<ol className="mb-3 last:mb-0 ml-4 list-decimal">{children}</ol>
	),
	li: ({ children }: { children: React.ReactNode }) => (
		<li className="mb-1">{children}</li>
	),
	blockquote: ({ children }: { children: React.ReactNode }) => (
		<blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic my-3">
			{children}
		</blockquote>
	),
	code: ({
		inline,
		children,
	}: { inline?: boolean; children: React.ReactNode }) =>
		inline ? (
			<code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
				{children}
			</code>
		) : (
			<code className="block bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg text-sm font-mono overflow-x-auto my-3">
				{children}
			</code>
		),
	pre: ({ children }: { children: React.ReactNode }) => (
		<div className="my-3">{children}</div>
	),
	h1: ({ children }: { children: React.ReactNode }) => (
		<h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>
	),
	h2: ({ children }: { children: React.ReactNode }) => (
		<h2 className="text-lg font-bold mb-3 mt-4 first:mt-0">{children}</h2>
	),
	h3: ({ children }: { children: React.ReactNode }) => (
		<h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>
	),
	h4: ({ children }: { children: React.ReactNode }) => (
		<h4 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h4>
	),
	table: ({ children }: { children: React.ReactNode }) => (
		<div className="overflow-x-auto my-3">
			<table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-600">
				{children}
			</table>
		</div>
	),
	th: ({ children }: { children: React.ReactNode }) => (
		<th className="border border-zinc-300 dark:border-zinc-600 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 font-semibold text-left">
			{children}
		</th>
	),
	td: ({ children }: { children: React.ReactNode }) => (
		<td className="border border-zinc-300 dark:border-zinc-600 px-3 py-2">
			{children}
		</td>
	),
};

// Reusable column component to reduce duplication
const MarkdownColumn = ({
	content,
	heading,
}: { content: string; heading?: string }) => (
	<div className={styles.column}>
		{heading && <h3 className={styles.heading}>{heading}</h3>}
		<div className={styles.content}>
			<div className={styles.prose}>
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkMath]}
					rehypePlugins={[rehypeKatex, rehypeHighlight]}
					components={markdownComponents as Components}
				>
					{content}
				</ReactMarkdown>
			</div>
		</div>
	</div>
);

export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		...components,
		Cover: ({
			src,
			alt,
			caption,
		}: {
			src: string;
			alt: string;
			caption: string;
		}) => {
			return (
				<figure className="my-0">
					<div className="aspect-[16/9] w-full overflow-hidden rounded-xl">
						<img src={src} alt={alt} className="h-full w-full object-contain" />
					</div>
					{caption && (
						<figcaption className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
							{caption}
						</figcaption>
					)}
				</figure>
			);
		},
		// New Twitter embed component
		Tweet: ({ id }: { id: string }) => (
			<div className="flex justify-center">
				<Tweet id={id} />
			</div>
		),
		ImageWithCaption: ({
			src,
			alt,
			caption,
		}: { src: string; alt: string; caption: string }) => {
			return (
				<figure className="my-0">
					<img src={src} alt={alt} className="h-full w-full object-contain" />
					{caption && (
						<figcaption
							className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400"
							dangerouslySetInnerHTML={{
								__html: caption.replace(
									/\[([^\]]+)\]\(([^)]+)\)/g,
									'<a href="$2" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">$1</a>',
								),
							}}
						/>
					)}
				</figure>
			);
		},
		SideBySideComparison: ({
			left,
			right,
			leftHeading,
			rightHeading,
		}: {
			left: string;
			right: string;
			leftHeading?: string;
			rightHeading?: string;
		}) => (
			<div className={styles.container}>
				<div className={styles.grid}>
					<MarkdownColumn content={left} heading={leftHeading} />
					<MarkdownColumn content={right} heading={rightHeading} />
				</div>
			</div>
		),
		ImageCarousel,
	};
}
