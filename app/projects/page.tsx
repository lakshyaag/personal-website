"use client";

import { motion } from "framer-motion";
import ProjectItem from "@/components/ProjectItem";
import { PROJECTS } from "@/lib/data/projects";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function Projects() {
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
				<div className="flex justify-between items-center mb-5">
					<h3 className="text-lg font-medium">Projects</h3>
				</div>
				<div className="grid grid-cols-1 gap-12 my-4 sm:gap-8 sm:grid-cols-2">
					{PROJECTS.sort(
						(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
					).map((project) => (
						<ProjectItem key={project.name} project={project} />
					))}
				</div>
			</motion.section>
		</motion.main>
	);
}
