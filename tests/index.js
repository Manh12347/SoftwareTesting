const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mochaCli = path.join(rootDir, 'node_modules', 'mocha', 'bin', 'mocha.js');
const reportHooks = path.join(rootDir, 'reportHooks.js');
const reportDir = path.join('mochawesome-report', 'all').replace(/\\/g, '/');

function collectTestFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return collectTestFiles(entryPath);
        }

        return entry.name.endsWith('.test.js') ? [entryPath] : [];
    });
}

const testFiles = collectTestFiles(path.join(rootDir, 'tests')).sort();

const args = [
    ...testFiles,
    '--timeout',
    '20000',
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

process.exit(result.status ?? 1);