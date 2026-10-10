import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
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
			<Analytics />
			<SpeedInsights />
			<Script
				data-goatcounter="https://lakshyaag.goatcounter.com/count"
				src="https://gc.zgo.at/count.js"
				strategy="afterInteractive"
			/>
		</div>
	);
}
