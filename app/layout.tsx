import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { Toaster } from "sonner";

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
				className={`${geist.variable} ${geistMono.variable} bg-white font-sans tracking-tight antialiased dark:bg-zinc-950`}
			>
				<ThemeProvider
					enableSystem={true}
					attribute="class"
					storageKey="theme"
					defaultTheme="system"
				>
					{children}
					<Analytics />
					<SpeedInsights />
					<Toaster position="top-center" />
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
