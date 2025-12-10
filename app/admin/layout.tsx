import type { ReactNode } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<div className="space-y-6">
			<AdminBackButton />
			{children}
		</div>
	);
}

