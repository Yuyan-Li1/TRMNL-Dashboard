import type { WidgetDisplay } from "@/types/schedule";

export interface LayoutSlot {
	id: string;
	row: number;
	col: number;
	width: 1 | 2; // Grid columns
	height: 1 | 2; // Grid rows
}

/**
 * Calculate optimal layout for widgets
 * Dashboard is 2 columns x 2 rows (4 slots)
 * Widgets can span 1 or 2 columns/rows
 */
export function calculateLayout(
	widgets: WidgetDisplay[],
): Map<WidgetDisplay, LayoutSlot> {
	const layout = new Map<WidgetDisplay, LayoutSlot>();

	// Grid state: true = occupied
	const grid = [
		[false, false], // Row 0
		[false, false], // Row 1
	];

	let slotId = 0;

	for (const widget of widgets) {
		const slot = findSlotForWidget(grid, widget.size);

		if (!slot) {
			// No space left
			break;
		}

		layout.set(widget, {
			id: `slot-${slotId++}`,
			...slot,
		});

		// Mark grid cells as occupied
		for (let r = slot.row; r < slot.row + slot.height; r++) {
			for (let c = slot.col; c < slot.col + slot.width; c++) {
				if (grid[r] && grid[r][c] !== undefined) {
					grid[r][c] = true;
				}
			}
		}
	}

	return layout;
}

/**
 * Find a slot for a widget based on its size
 */
function findSlotForWidget(
	grid: boolean[][],
	size: WidgetDisplay["size"],
): Omit<LayoutSlot, "id"> | null {
	const requirements = getSizeRequirements(size);

	// Try to find a slot that fits
	for (let row = 0; row <= 2 - requirements.height; row++) {
		for (let col = 0; col <= 2 - requirements.width; col++) {
			if (canFit(grid, row, col, requirements.width, requirements.height)) {
				return {
					row,
					col,
					width: requirements.width as 1 | 2,
					height: requirements.height as 1 | 2,
				};
			}
		}
	}

	return null;
}

/**
 * Check if a widget can fit at a position
 */
function canFit(
	grid: boolean[][],
	row: number,
	col: number,
	width: number,
	height: number,
): boolean {
	for (let r = row; r < row + height; r++) {
		for (let c = col; c < col + width; c++) {
			if (!grid[r] || grid[r][c] === undefined || grid[r][c]) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Convert widget size to grid requirements
 */
function getSizeRequirements(size: WidgetDisplay["size"]): {
	width: number;
	height: number;
} {
	switch (size) {
		case "small":
			return { width: 1, height: 1 };
		case "medium":
			return { width: 1, height: 1 };
		case "large":
			return { width: 1, height: 2 };
		case "full":
			return { width: 2, height: 1 };
		default:
			return { width: 1, height: 1 };
	}
}

/**
 * Generate CSS grid style for a slot
 */
export function getSlotStyle(slot: LayoutSlot): React.CSSProperties {
	return {
		gridColumn: `${slot.col + 1} / span ${slot.width}`,
		gridRow: `${slot.row + 1} / span ${slot.height}`,
	};
}
