const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mochaCli = path.join(rootDir, 'node_modules', 'mocha', 'bin', 'mocha.js');
const reportHooks = path.join(rootDir, 'reportHooks.js');
const reportDir = path.join('mochawesome-report', 'all').replace(/\\/g, '/');

const args = [
    'tests/**/*.test.js',
    '--require',
    reportHooks,
    '--reporter',
    'mochawesome',
    '--reporter-options',
    `reportDir=${reportDir},reportFilename=full_report_all_ultimate,quiet=true,overwrite=true,html=true,json=true`
];

const result = spawnSync(process.execPath, [mochaCli, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false
});

const sourceScreenshotsDir = path.join(rootDir, 'screenshots');
const mirroredScreenshotsDir = path.join(rootDir, 'mochawesome-report', 'screenshots');

if (fs.existsSync(sourceScreenshotsDir)) {
    fs.mkdirSync(mirroredScreenshotsDir, { recursive: true });
    fs.cpSync(sourceScreenshotsDir, mirroredScreenshotsDir, { recursive: true });
}

process.exit(result.status ?? 1);