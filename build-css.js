// build-css.js
const { execSync } = require('child_process');
const path = require('path');

const tailwindBin = path.join(__dirname, 'node_modules', '.bin', 'tailwindcss.cmd');
const inputFile = path.join(__dirname, 'public', 'css', 'tailwind.css');
const outputFile = path.join(__dirname, 'public', 'css', 'styles.css');

try {
    const command = `"${tailwindBin}" -i "${inputFile}" -o "${outputFile}"`;
    console.log('Running command:', command);
    execSync(command, { stdio: 'inherit' });
    console.log('CSS built successfully!');
} catch (error) {
    console.error('Build failed:', error);
}
