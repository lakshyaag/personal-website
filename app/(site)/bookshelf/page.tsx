import { publicBooks, publicRecommendations } from "@/lib/backend/public-data";
import Bookshelf from "./bookshelf";

export default async function BookshelfPage() {
	const [books, recommendations] = await Promise.all([
		publicBooks(),
		publicRecommendations(),
	]);
	return <Bookshelf books={books} recommendations={recommendations} />;
}
