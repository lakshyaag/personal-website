import {
	MorphingDialog,
	MorphingDialogTrigger,
	MorphingDialogContent,
	MorphingDialogClose,
	MorphingDialogContainer,
} from "@/components/ui/morphing-dialog";
import { ExternalLink, XIcon } from "lucide-react";
import MagneticSocialLink from "./MagneticSocialLink";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ProjectImageProps = {
	src?: string;
	project: Project;
};

export function ProjectImage({ src, project }: ProjectImageProps) {
	if (!src) return null;
	return (
		<MorphingDialog
			transition={{
				type: "spring",
				bounce: 0,
				duration: 0.3,
			}}
		>
			<MorphingDialogTrigger>
				<div className="aspect-[16/9] w-full overflow-hidden rounded-xl">
					<img
						src={src}
						alt={project.name}
						className="h-full w-full object-cover"
					/>
				</div>
			</MorphingDialogTrigger>
			<MorphingDialogContainer>
				<MorphingDialogContent className="relative max-h-[80vh] w-[90vw] max-w-3xl overflow-y-auto rounded-2xl bg-zinc-50 p-6 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
					<div className="space-y-6">
						<div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
							<img
								src={src}
								alt={project.name}
								className="h-full w-full object-contain"
							/>
						</div>

						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
									{project.name}
								</h3>
								{project.external && (
									<div className="flex flex-col gap-2">
										{project.external.map(({ label, link }) => (
											<MagneticSocialLink key={link} link={link}>
												{label}
											</MagneticSocialLink>
										))}
									</div>
								)}
							</div>

							{project.tech && (
								<div className="flex flex-wrap gap-2">
									{project.tech.sort().map((tech) => (
										<span
											key={tech}
											className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
										>
											{tech}
										</span>
									))}
								</div>
							)}

							<div className="prose prose-zinc dark:prose-invert">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{project.content}
								</ReactMarkdown>
							</div>
						</div>
					</div>
				</MorphingDialogContent>
				<MorphingDialogClose
					className="fixed right-6 top-6 h-fit w-fit rounded-full bg-white p-1 dark:bg-zinc-800"
					variants={{
						initial: { opacity: 0 },
						animate: {
							opacity: 1,
							transition: { delay: 0.3, duration: 0.1 },
						},
						exit: { opacity: 0, transition: { duration: 0 } },
					}}
				>
					<XIcon className="h-5 w-5 text-zinc-500" />
				</MorphingDialogClose>
			</MorphingDialogContainer>
		</MorphingDialog>
	);
}
