"use client";
import Link from "next/link";
import { motion } from "motion/react";

import { Spotlight } from "@/components/ui/spotlight";
import { Magnetic } from "@/components/ui/magnetic";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { SOCIAL_LINKS } from "@/lib/data/social";
import { PROJECTS } from "@/lib/data/projects";
import { WORK_EXPERIENCE } from "@/lib/data/jobs";
import { EMAIL } from "@/lib/data/email";
import { BLOG_POSTS } from "@/lib/data/blogs";
import ProjectItem from "@/components/ProjectItem";
import MagneticSocialLink from "@/components/MagneticSocialLink";

const VARIANTS_CONTAINER = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
		},
	},
};

const VARIANTS_SECTION = {
	hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
	visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const TRANSITION_SECTION = {
	duration: 0.3,
};

export default function Personal() {
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
				<div className="flex-1">
					<p className="text-zinc-600 dark:text-zinc-400">
						I'm an AI engineer who loves working at the intersection of business
						and technology. From machine learning to product strategy, I bring a
						unique blend of technical and strategic thinking to solve complex
						problems.
					</p>
				</div>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<h3 className="mb-5 text-lg font-medium">Selected Projects</h3>
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					{PROJECTS.sort(
						(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
					).map((project) => (
						<ProjectItem key={project.name} project={project} />
					))}
				</div>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<h3 className="mb-5 text-lg font-medium">Work Experience</h3>
				<div className="flex flex-col space-y-2">
					{WORK_EXPERIENCE.map((job) => (
						<a
							className="relative overflow-hidden rounded-2xl bg-zinc-300/30 p-[1px] dark:bg-zinc-600/30"
							href={job.link}
							target="_blank"
							rel="noopener noreferrer"
							key={job.id}
						>
							<Spotlight
								className="from-zinc-900 via-zinc-800 to-zinc-700 blur-2xl dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-50"
								size={64}
							/>
							<div className="relative h-full w-full rounded-[15px] bg-white p-4 dark:bg-zinc-950">
								<div className="relative flex w-full flex-row justify-between">
									<div>
										<h4 className="font-normal dark:text-zinc-100">
											{job.title}
										</h4>
										<p className="text-zinc-500 dark:text-zinc-400">
											{job.company}
										</p>
									</div>
									<p className="text-zinc-600 dark:text-zinc-400">
										{job.start} - {job.end}
									</p>
								</div>
							</div>
						</a>
					))}
				</div>
			</motion.section>

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
						{BLOG_POSTS.map((post) => (
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
									<p className="text-zinc-500 dark:text-zinc-400">
										{post.description}
									</p>
								</div>
							</Link>
						))}
					</AnimatedBackground>
				</div>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<h3 className="mb-5 text-lg font-medium">Connect</h3>
				<p className="mb-5 text-zinc-600 dark:text-zinc-400">
					Feel free to contact me at{" "}
					<a className="underline dark:text-zinc-300" href={`mailto:${EMAIL}`}>
						{EMAIL}
					</a>
				</p>
				<div className="flex items-center justify-start space-x-3">
					{SOCIAL_LINKS.map((link) => (
						<MagneticSocialLink key={link.label} link={link.link}>
							{link.label}
						</MagneticSocialLink>
					))}
				</div>
			</motion.section>
		</motion.main>
	);
}
