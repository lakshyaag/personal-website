import { publicBooks, publicGallery } from "@/lib/backend/public-data";
import Home from "./home";

export default async function Page() {
	const [books, photos] = await Promise.all([publicBooks(), publicGallery()]);
	return (
		<Home
			currentBook={books.find((book) => book.isCurrent) ?? null}
			photos={photos}
		/>
	);
}
