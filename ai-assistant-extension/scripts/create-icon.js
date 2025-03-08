#!/usr/bin/env node

/**
 * Creates a minimal PNG icon for the extension if it doesn't exist
 */

const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '..', 'media', 'icon.png');

// Create media directory if it doesn't exist
const mediaDir = path.dirname(iconPath);
if (!fs.existsSync(mediaDir)) {
	fs.mkdirSync(mediaDir, { recursive: true });
}

// Check if icon already exists
if (!fs.existsSync(iconPath)) {
	console.log('Creating minimal icon.png...');

	// This is a base64 encoded 1x1 pixel PNG
	const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAjFJREFUeJzt1jERwDAMBLEDC/PnOTKI4S7gqb0ZeWqu7Z4FQNPXHgDAO4IHCBMBQJkIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABAmAoAwEQCEiQAgTAQAYSIACBMBQJgIAMJEABD2A40LBBo8DeAlAAAAAElFTkSuQmCC', 'base64');
	fs.writeFileSync(iconPath, minimalPng);
	console.log(`Created icon at: ${iconPath}`);
} else {
	console.log(`Icon already exists at: ${iconPath}`);
}
