"use client";

import { useState } from "react";

export default function AdminLoginPage(): React.JSX.Element {
	const [token, setToken] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault();
		setError("");
		setBusy(true);

		try {
			const res = await fetch("/api/admin/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});

			if (res.ok) {
				window.location.href = "/admin";
				return;
			}
			setError("That token was not accepted. Check CRON_SECRET in Vercel.");
		} catch {
			setError("The request did not reach the server. Try again.");
		}
		setBusy(false);
	};

	return (
		<div className="mx-auto max-w-[360px] pt-[12vh]">
			<h1 className="m-0 type-42">TRMNL</h1>
			<p className="mt-2 mb-8 text-eink-dark">The admin area.</p>

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<label htmlFor="token" className="block font-bold">
						Admin token
					</label>
					<input
						id="token"
						type="password"
						value={token}
						onChange={(e) => setToken(e.target.value)}
						aria-describedby="token-hint"
						autoComplete="current-password"
						className="block w-full border-2 border-eink-black bg-eink-white px-3 py-[7px]"
						required
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- the page's only field
						autoFocus
					/>
					<p id="token-hint" className="m-0 text-eink-dark">
						The value of CRON_SECRET.
					</p>
				</div>

				<p role="alert" className="m-0 font-bold text-signal empty:hidden">
					{error}
				</p>

				<button type="submit" disabled={busy} className="admin-button w-full">
					{busy ? "Signing in" : "Sign in"}
				</button>
			</form>
		</div>
	);
}
