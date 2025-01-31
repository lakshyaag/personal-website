import type { MDXComponents } from "mdx/types";

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
					<div className= "aspect-[16/9] w-full overflow-hidden rounded-xl">
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
	};
}
