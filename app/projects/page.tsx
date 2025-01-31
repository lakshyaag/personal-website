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
				<h1>Under construction!</h1>
			</motion.section>
		</motion.main>
	);
}
