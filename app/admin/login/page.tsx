"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function AdminLogin() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const supabase = createClient();
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				toast.error(error.message);
				return;
			}

			if (data.session) {
				toast.success("Logged in successfully!");
				const redirectTo = searchParams.get("redirectTo") || "/admin";
				router.push(redirectTo);
				router.refresh();
			}
		} catch (error) {
			toast.error("An error occurred during login");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<motion.main
			className="flex min-h-[calc(100vh-12rem)] items-center justify-center"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			<motion.div
				className="w-full max-w-md space-y-8"
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<div className="space-y-2">
					<h1 className="text-3xl font-medium text-zinc-900 dark:text-zinc-50">
						Admin
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400">
						Sign in to access the admin dashboard
					</p>
				</div>

				<form className="space-y-6" onSubmit={handleLogin}>
					<div className="space-y-4">
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
							>
								Email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
								placeholder="your@email.com"
								disabled={loading}
							/>
						</div>
						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
							>
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
								placeholder="Enter your password"
								disabled={loading}
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>
			</motion.div>
		</motion.main>
	);
}
