/**
 * Airport visits API routes
 * Migrated to use consolidated API route builder
 */

import { createCrudRoutes } from "@/lib/api-route-builder";
import { getVisits, saveVisit, deleteVisit } from "@/lib/visits-db";
import type { Visit } from "@/lib/models";

export const { GET, POST, DELETE } = createCrudRoutes<Visit>({
	dbOperations: {
		getAll: getVisits,
		save: saveVisit,
		delete: deleteVisit,
	},
	entityName: "visit",
	requiredFields: ["airportIdent", "date"],
});
