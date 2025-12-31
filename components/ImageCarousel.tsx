"use client";

import * as React from "react";

interface ImageCarouselProps {
	images: { src: string; alt: string; caption?: string }[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
	const [currentIndex, setCurrentIndex] = React.useState(0);
	const [isTransitioning, setIsTransitioning] = React.useState(false);

	const goToPrevious = () => {
		if (isTransitioning) return;
		setIsTransitioning(true);
		setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
		setTimeout(() => setIsTransitioning(false), 300);
	};

	const goToNext = () => {
		if (isTransitioning) return;
		setIsTransitioning(true);
		setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
		setTimeout(() => setIsTransitioning(false), 300);
	};

	const goToIndex = (index: number) => {
		if (isTransitioning || index === currentIndex) return;
		setIsTransitioning(true);
		setCurrentIndex(index);
		setTimeout(() => setIsTransitioning(false), 300);
	};

	// Keyboard navigation
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (isTransitioning) return;
			if (e.key === "ArrowLeft") {
				setIsTransitioning(true);
				setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
				setTimeout(() => setIsTransitioning(false), 300);
			} else if (e.key === "ArrowRight") {
				setIsTransitioning(true);
				setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
				setTimeout(() => setIsTransitioning(false), 300);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isTransitioning, images.length]);

	return (
		<figure className="my-6">
			<div className="relative group">
				{/* Main image container */}
				<div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shadow-lg">
					<div className="aspect-video w-full relative">
						<div
							key={currentIndex}
							className="absolute inset-0 transition-opacity duration-300 ease-in-out"
						>
							<img
								src={images[currentIndex].src}
								alt={images[currentIndex].alt}
								className="h-full w-full object-contain"
								loading="lazy"
							/>
						</div>
					</div>
				</div>

				{/* Navigation arrows */}
				<button
					onClick={goToPrevious}
					className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 shadow-lg hover:bg-white dark:hover:bg-zinc-800 hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
					aria-label="Previous image"
					type="button"
				>
					<svg
						className="w-5 h-5 text-zinc-700 dark:text-zinc-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Previous</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2.5}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<button
					onClick={goToNext}
					className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 shadow-lg hover:bg-white dark:hover:bg-zinc-800 hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
					aria-label="Next image"
					type="button"
				>
					<svg
						className="w-5 h-5 text-zinc-700 dark:text-zinc-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Next</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2.5}
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</button>
			</div>

			{/* Caption */}
			{images[currentIndex].caption && (
				<figcaption className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400 font-medium">
					{images[currentIndex].caption}
				</figcaption>
			)}

			{/* Dot indicators */}
			<div className="flex justify-center gap-2 mt-4">
				{images.map((image, index) => (
					<button
						key={image.src}
						onClick={() => goToIndex(index)}
						className={`rounded-full transition-all duration-200 ${
							index === currentIndex
								? "w-8 h-2 bg-zinc-700 dark:bg-zinc-300"
								: "w-2 h-2 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500 hover:scale-125"
						}`}
						aria-label={`Go to image ${index + 1}`}
						type="button"
					/>
				))}
			</div>

			{/* Counter */}
			<div className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-3 font-medium">
				{currentIndex + 1} / {images.length}
			</div>
		</figure>
	);
}
