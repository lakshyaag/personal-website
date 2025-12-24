"use client";

import { useEffect, useState, useCallback } from "react";

interface Heading {
	id: string;
	text: string;
	level: number;
}

export function TableOfContents() {
	const [headings, setHeadings] = useState<Heading[]>([]);
	const [activeId, setActiveId] = useState<string>("");
	const [isHovered, setIsHovered] = useState(false);

	// Extract headings from DOM on mount
	useEffect(() => {
		const elements = Array.from(
			document.querySelectorAll("main h2[id], main h3[id]"),
		) as HTMLHeadingElement[];

		const headingData = elements.map((elem) => ({
			id: elem.id,
			text: elem.textContent || "",
			level: Number(elem.tagName.charAt(1)),
		}));

		setHeadings(headingData);
	}, []);

	// IntersectionObserver for active section tracking
	useEffect(() => {
		if (headings.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visibleHeadings = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

				if (visibleHeadings.length > 0) {
					setActiveId(visibleHeadings[0].target.id);
				}
			},
			{
				rootMargin: "-80px 0px -70% 0px",
				threshold: 0,
			},
		);

		for (const heading of headings) {
			const element = document.getElementById(heading.id);
			if (element) {
				observer.observe(element);
			}
		}

		return () => observer.disconnect();
	}, [headings]);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
			e.preventDefault();
			const element = document.getElementById(id);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		},
		[],
	);

	if (headings.length === 0) {
		return null;
	}

	const activeIndex = headings.findIndex((h) => h.id === activeId);

	return (
		<nav
			className="fixed left-0 top-1/2 -translate-y-1/2 z-20 hidden lg:block"
			aria-label="Table of contents"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="flex items-start">
				{/* Collapsed: Horizontal lines representing headings */}
				<div
					className={`
						flex flex-col py-4 pl-3 gap-3
						transition-opacity duration-200
						${isHovered ? "opacity-0" : "opacity-100"}
					`}
				>
					{headings.map((heading, index) => {
						const isH3 = heading.level === 3;
						const isActive = index === activeIndex;

						return (
							<div
								key={heading.id}
								className={`
									h-px transition-all duration-200
									${isH3 ? "w-4 ml-2" : "w-6"}
									${
										isActive
											? "bg-zinc-900 dark:bg-zinc-100 h-[2px]"
											: "bg-zinc-300 dark:bg-zinc-600"
									}
								`}
							/>
						);
					})}
				</div>

				{/* Expanded: Text labels only */}
				<div
					className={`
						absolute left-0 top-0 py-4 pl-3 pr-2 max-w-44
						transition-all duration-200 ease-out
						${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}
					`}
				>
					<ul className="space-y-2">
						{headings.map((heading: Heading) => {
							const isH3 = heading.level === 3;

							return (
								<li key={heading.id}>
									<a
										href={`#${heading.id}`}
										onClick={(e) => handleClick(e, heading.id)}
										title={heading.text}
										className={`
											block text-sm leading-tight truncate transition-colors duration-150
											${isH3 ? "pl-3" : ""}
											${
												activeId === heading.id
													? "text-zinc-900 dark:text-zinc-100 font-medium"
													: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
											}
										`}
									>
										{heading.text}
									</a>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</nav>
	);
}
