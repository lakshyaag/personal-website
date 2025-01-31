import { ProjectImage } from "./ProjectDetails";
import { Spotlight } from "./ui/spotlight";
import { SvgArrowRight } from "./ui/svg-arrow-right";

type ProjectProps = {
	project: Project;
};

const ProjectItem = ({ project }: ProjectProps) => {
	return (
		<div key={project.name} className="space-y-2">
			<div className="relative rounded-2xl bg-zinc-50/40 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950/40 dark:ring-zinc-800/50">
				<Spotlight
					className="from-zinc-900 via-zinc-800 to-zinc-700 blur-2xl dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-50"
					size={64}
				/>
				<ProjectImage src={project.image} project={project} />
			</div>
			<div className="px-1">
				<a
					className="font-base group relative inline-flex items-center gap-[1px] font-[450] text-zinc-900 dark:text-zinc-50"
					href={project.link}
					target="_blank"
					rel="noopener noreferrer"
				>
					{project.name}
					<SvgArrowRight
						link={project.link}
						className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					/>
					<span className="absolute bottom-0.5 left-0 block h-[1px] w-full max-w-0 bg-zinc-900 transition-all duration-200 group-hover:max-w-full" />
				</a>

				<p className="text-base text-zinc-600 dark:text-zinc-400">
					{project.description}
				</p>
			</div>
		</div>
	);
};

export default ProjectItem;
