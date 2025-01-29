import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "./header";
import { Footer } from "./footer";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: "#ffffff",
};

export const metadata: Metadata = {
	title: "Lakshya Agarwal",
	description: "Lakshya Agarwal's personal corner on the Internet!",
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
					<SpeedInsights />
				</ThemeProvider>
			</body>
		</html>
	);
}
