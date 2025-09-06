import { ImageResponse } from "next/og";
import { BLOG_POSTS } from "@/lib/data/blogs";

export const runtime = "edge";

const width = 1200;
const height = 630;

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug: rawSlug } = await params;
	const slug = Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug ?? "");
	const link = `/blogs/${slug}`;
	const post = BLOG_POSTS.find((p) => p.link === link);

	const title = post?.title ?? "Lakshya Agarwal";
	const description = post?.description ?? "lakshyaag.com";

	return new ImageResponse(
		<div
			style={{
				width,
				height,
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: 64,
				background:
					"linear-gradient(135deg, #09090b 0%, #111827 50%, #0b1324 100%)",
				color: "#e5e7eb",
				fontFamily: "Inter, Segoe UI, Arial, sans-serif",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
				<div
					style={{
						width: 48,
						height: 48,
						borderRadius: 12,
						background: "#fafafa",
					}}
				/>
				<div style={{ fontSize: 24, color: "#d4d4d8" }}>lakshyaag.com</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div
					style={{
						fontSize: 64,
						lineHeight: 1.1,
						fontWeight: 600,
						color: "#fafafa",
					}}
				>
					{title}
				</div>
				<div style={{ fontSize: 28, color: "#a1a1aa" }}>{description}</div>
			</div>

			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<div style={{ fontSize: 28, color: "#a1a1aa" }}>{link}</div>
				<div style={{ fontSize: 24, color: "#a1a1aa" }}>@lakshyaag</div>
			</div>
		</div>,
		{
			width,
			height,
		},
	);
}
