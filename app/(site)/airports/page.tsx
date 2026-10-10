import { publicVisits } from "@/lib/backend/public-data";
import Airports from "./airports";

export default async function AirportsPage() {
	return <Airports visits={await publicVisits()} />;
}
