import { Magnetic } from "./ui/magnetic";
import { SvgArrowRight } from "./ui/svg-arrow-right";

function MagneticSocialLink({
	children,
	link,
}: {
	children: React.ReactNode;
	link: string;
}) {
	return (
		<Magnetic springOptions={{ bounce: 0 }} intensity={0.3}>
			<a
				href={link}
				className="group relative inline-flex shrink-0 items-center gap-[1px] rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-black transition-colors duration-200 hover:bg-zinc-950 hover:text-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
			>
				{children}
				<SvgArrowRight link={link} />
			</a>
		</Magnetic>
	);
}

export default MagneticSocialLink;
