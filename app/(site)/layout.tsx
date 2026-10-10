import { Footer } from "./footer";
import { Header } from "./header";

export default function SiteLayout({
	children,
}: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen w-screen flex-col font-sans">
			<div className="relative mx-auto w-full max-w-screen-lg flex-1 px-4 pt-20">
				<Header />
				{children}
				<Footer />
			</div>
		</div>
	);
}
