import { publicGallery } from "@/lib/backend/public-data";
import Gallery from "./gallery";

export default async function PhotosPage() {
	return <Gallery photos={await publicGallery()} />;
}
