import { publicFlights } from "@/lib/backend/public-data";
import Airports from "./airports";

export default async function AirportsPage() {
	return <Airports {...(await publicFlights())} />;
}
