import {
	authConfigured,
	ownerAllowed,
	safeRedirect,
} from "@/lib/backend/config";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
	providers: [GitHub],
	pages: { signIn: "/admin/login", error: "/admin/login" },
	session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
	callbacks: {
		async signIn({ account, profile }) {
			return (
				authConfigured() &&
				account?.provider === "github" &&
				ownerAllowed(profile?.id)
			);
		},
		async jwt({ token, account, profile }) {
			if (account?.provider === "github" && profile)
				token.ownerId = String(profile.id);
			return token;
		},
		async session({ session, token }) {
			// Re-evaluate the allowlist on every request, including existing sessions.
			if (session.user)
				session.user.id = ownerAllowed(token.ownerId)
					? String(token.ownerId)
					: "";
			return session;
		},
		async redirect({ url, baseUrl }) {
			try {
				const parsed = new URL(url, baseUrl);
				if (parsed.origin !== new URL(baseUrl).origin)
					return `${baseUrl}/admin/journal`;
				return baseUrl + safeRedirect(parsed.pathname + parsed.search);
			} catch {
				return `${baseUrl}/admin/journal`;
			}
		},
	},
});
