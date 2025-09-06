import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "./header";
import { Footer } from "./footer";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: "#ffffff",
};

export const metadata: Metadata = {
	title: "Lakshya Agarwal",
	description: "Lakshya Agarwal's personal corner on the Internet!",
	authors: [{ name: "Lakshya Agarwal", url: "https://lakshyaag.com" }],
	openGraph: {
		title: "Lakshya Agarwal",
		images: [
			{
				url: "/og.png",
				width: 800,
				height: 400,
			},
		],
		description: "Lakshya Agarwal's personal corner on the Internet!",
		url: "https://lakshyaag.com",
		locale: "en_US",
		type: "website",
		siteName: "Lakshya Agarwal",
	},
	twitter: {
		card: "summary_large_image",
		title: "Lakshya Agarwal",
		description: "Lakshya Agarwal's personal corner on the Internet!",
		creator: "@lakshyaag",
		images: ["/og.png"],
	},
};

const geist = Geist({
	variable: "--font-geist",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geist.variable} ${geistMono.variable} bg-white tracking-tight antialiased dark:bg-zinc-950`}
			>
				<ThemeProvider
					enableSystem={true}
					attribute="class"
					storageKey="theme"
					defaultTheme="system"
				>
					<div className="flex min-h-screen w-screen flex-col font-[family-name:var(--font-inter-tight)]">
						<div className="relative mx-auto w-full max-w-screen-md flex-1 px-4 pt-20">
							<Header />
							{children}
							<Footer />
						</div>
					</div>
					<Analytics />
					<SpeedInsights />
					<Script
						data-goatcounter="https://lakshyaag.goatcounter.com/count"
						src="https://gc.zgo.at/count.js"
						strategy="afterInteractive"
					/>
				</ThemeProvider>
			</body>
		</html>
	);
}
