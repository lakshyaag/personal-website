import FoodApp from "@/components/admin/food/FoodApp";

export default async function FoodPage({
	searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
	return <FoodApp editId={(await searchParams).edit} />;
}
