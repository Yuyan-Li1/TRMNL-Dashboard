"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminLoginPage() {
	const [token, setToken] = useState("");
	const [error, setError] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

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
			setError("Invalid token. Please check your CRON_SECRET value.");
		} catch {
			setError("Connection error. Is the server running?");
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-100">
			<div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
				<h1 className="mb-2 text-2xl font-bold text-gray-900">TRMNL Admin</h1>
				<p className="mb-6 text-sm text-gray-500">
					Enter the admin token (CRON_SECRET) to continue.
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="token"
							className="block text-sm font-medium text-gray-700"
						>
							Admin Token
						</label>
						<input
							id="token"
							type="password"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
							required
							ref={inputRef}
						/>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<button
						type="submit"
						className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						Sign In
					</button>
				</form>
			</div>
		</div>
	);
}
