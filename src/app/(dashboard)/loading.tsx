export default function DashboardLoading() {
	return (
		<div className="trmnl-container flex items-center justify-center bg-eink-white">
			<div className="text-center">
				<p className="text-eink-lg font-bold">Loading...</p>
				<p className="text-eink-sm mt-2 text-eink-dark">
					Fetching dashboard data
				</p>
			</div>
		</div>
	);
}
