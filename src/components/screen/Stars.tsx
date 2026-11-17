const STAR =
	"M10 1.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L1.4 7.9l6-.8z";

interface StarsProps {
	/** Out of five, in half-star steps */
	value: number;
	/** Pixel size of one star */
	size?: number;
}

/** A rating as five stars with half stars. */
export function Stars({ value, size = 20 }: StarsProps): React.JSX.Element {
	return (
		<span className="flex gap-0.5" role="img" aria-label={`${value} out of 5`}>
			{[0, 1, 2, 3, 4].map((index) => {
				const fill = Math.max(0, Math.min(1, value - index));
				// The outline stays 2px on screen whatever the star's size
				const strokeWidth = (2 * 20) / size;
				const clipId = `star-${size}-${index}-${fill}`;
				return (
					<svg
						key={index}
						width={size}
						height={size}
						viewBox="0 0 20 20"
						aria-hidden="true"
					>
						<clipPath id={clipId}>
							<rect x="0" y="0" width={20 * fill} height="20" />
						</clipPath>
						<path d={STAR} fill="currentColor" clipPath={`url(#${clipId})`} />
						<path
							d={STAR}
							fill="none"
							stroke="currentColor"
							strokeWidth={strokeWidth}
							strokeLinejoin="round"
						/>
					</svg>
				);
			})}
		</span>
	);
}
