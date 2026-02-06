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
		<div className="min-h-screen flex items-center justify-center bg-gray-100">
			<div className="max-w-md w-full bg-white shadow rounded-lg p-8">
				<h1 className="text-2xl font-bold text-gray-900 mb-2">TRMNL Admin</h1>
				<p className="text-sm text-gray-500 mb-6">
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
						className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						Sign In
					</button>
				</form>
			</div>
		</div>
	);
}
