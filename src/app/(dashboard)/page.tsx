export default function DashboardPage() {
	return (
		<div className="trmnl-container flex items-center justify-center">
			<div className="text-center">
				<h1 className="mb-4 text-(length:--font-size-eink-2xl) font-bold leading-(--line-height-eink-2xl)">
					TRMNL Dashboard
				</h1>
				<p className="text-eink-secondary text-(length:--font-size-eink-lg) leading-(--line-height-eink-lg)">
					Setup in progress...
				</p>

				{/* E-ink color verification swatches */}
				<div className="mt-8 flex items-center justify-center gap-4">
					<div className="flex flex-col items-center gap-1">
						<div className="h-8 w-8 bg-eink-black" />
						<span className="text-xs">Black</span>
					</div>
					<div className="flex flex-col items-center gap-1">
						<div className="h-8 w-8 bg-eink-dark" />
						<span className="text-xs">Dark</span>
					</div>
					<div className="flex flex-col items-center gap-1">
						<div className="h-8 w-8 border border-eink-dark bg-eink-light" />
						<span className="text-xs">Light</span>
					</div>
					<div className="flex flex-col items-center gap-1">
						<div className="h-8 w-8 border border-eink-dark bg-eink-white" />
						<span className="text-xs">White</span>
					</div>
				</div>
			</div>
		</div>
	);
}
