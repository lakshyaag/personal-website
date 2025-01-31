"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/data/blogs";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { AnimatedBackground } from "@/components/ui/animated-background";

export default function Blogs() {
	return (
		<motion.main
			className="space-y-24"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<h3 className="mb-3 text-lg font-medium">Blog</h3>
				<div className="flex flex-col space-y-0">
					<AnimatedBackground
						enableHover
						className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
						transition={{
							type: "spring",
							bounce: 0,
							duration: 0.2,
						}}
					>
						{BLOG_POSTS.sort(
							(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
						).map((post) => (
							<Link
								key={post.uid}
								className="-mx-3 rounded-xl px-3 py-3"
								href={post.link}
								data-id={post.uid}
							>
								<div className="flex flex-col space-y-1">
									<h4 className="font-normal dark:text-zinc-100">
										{post.title}
									</h4>
									<p className="text-zinc-500 dark:text-zinc-400 text-sm">
										{post.description}
									</p>
								</div>
							</Link>
						))}
					</AnimatedBackground>
				</div>
			</motion.section>
		</motion.main>
	);
}
