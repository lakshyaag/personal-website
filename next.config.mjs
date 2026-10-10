import createMDX from "@next/mdx";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Browser tests use their own build dir so they can run beside `bun run dev`.
	distDir: process.env.NEXT_DIST_DIR ?? ".next",
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "books.google.com",
			},
		],
	},
};

const withMDX = createMDX({
	extension: /\.mdx?$/,
	options: {
		remarkPlugins: [remarkGfm, remarkMath],
		rehypePlugins: [rehypeSlug, rehypeKatex, rehypeHighlight],
	},
});

export default withMDX(nextConfig);
