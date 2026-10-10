import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
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
					<Toaster position="top-center" />
				</ThemeProvider>
			</body>
		</html>
	);
}
