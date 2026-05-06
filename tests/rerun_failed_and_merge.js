const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const reportPath = path.join(rootDir, 'mochawesome-report', 'all', 'full_report_all_ultimate.json');
const retryDir = path.join(rootDir, 'mochawesome-report', 'retry');
const retryReportPath = path.join(retryDir, 'mochawesome_rerun.json');

// 1. Đọc file json báo cáo chính
console.log('📖 Đang đọc báo cáo chính...');
if (!fs.existsSync(reportPath)) {
    console.log('⚠️  Báo cáo chính không tìm thấy, chạy full test trước...');
    const fullRun = spawnSync('npm', ['run', 'test:all'], { cwd: rootDir, stdio: 'inherit', shell: true });
    if (fullRun.status !== 0) {
        console.error('❌ Full test run failed');
        process.exit(fullRun.status ?? 1);
    }
}

const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const failedFiles = new Set();

// 2. Lặp qua các suites để tìm file bị lỗi
console.log('\n🔍 Tìm kiếm các test bị lỗi...');
reportData.results[0].suites.forEach(suite => {
    // Check test failures
    const hasFailedTests = suite.tests && suite.tests.some(test => test.state === 'failed');
    
    // Check hook failures (state: failed = actual failure)
    const hasFailedHooks = (
        (suite.beforeHooks && suite.beforeHooks.some(h => h.state === 'failed')) ||
        (suite.afterHooks && suite.afterHooks.some(h => h.state === 'failed'))
    );

    if (hasFailedTests || hasFailedHooks) {
        failedFiles.add(suite.fullFile);
    }
});

if (failedFiles.size === 0) {
    console.log('✅ Không tìm thấy test nào bị lỗi!');
    process.exit(0);
}

const filesArray = Array.from(failedFiles);
console.log(`\n⚠️  Tìm thấy ${failedFiles.size} file bị lỗi:`);
filesArray.forEach(f => console.log(`  - ${f}`));

// 3. Chạy lại các file bị lỗi
console.log('\n🔄 Chạy lại các test bị lỗi...');
fs.mkdirSync(retryDir, { recursive: true });

const mochaCli = path.join(rootDir, 'node_modules', 'mocha', 'bin', 'mocha.js');
const reportHooks = path.join(rootDir, 'reportHooks.js');

const mochaArgs = [
    mochaCli,
    ...filesArray,
    '--require', reportHooks,
    '--reporter', 'mochawesome',
    '--reporter-options',
    `reportDir=${retryDir.replace(/\\/g, '/')},reportFilename=mochawesome_rerun,overwrite=true,html=false,json=true`
];

const rerun = spawnSync(process.execPath, mochaArgs, { cwd: rootDir, stdio: 'inherit', shell: false });
if (!fs.existsSync(retryReportPath)) {
    console.error('❌ Rerun report không được tạo');
    process.exit(1);
}

// 4. Merge kết quả vào report chính
console.log('\n🔀 Ghi đè kết quả vào báo cáo chính...');
const rerunData = JSON.parse(fs.readFileSync(retryReportPath, 'utf8'));

// Tạo map các test rerun theo fullTitle + file để dễ lookup
const rerunTestMap = new Map();
function collectRerunTests(suites) {
    if (!suites) return;
    suites.forEach(suite => {
        if (suite.tests) {
            suite.tests.forEach(test => {
                const key = `${test.fullTitle}||${test.file}`;
                rerunTestMap.set(key, test);
            });
        }
        if (suite.suites) collectRerunTests(suite.suites);
    });
}
collectRerunTests(rerunData.results?.[0]?.suites);

// Thay thế test trong main report bằng test từ rerun
let replacedCount = 0;
function replaceTests(suites) {
    if (!suites) return;
    suites.forEach(suite => {
        if (suite.tests) {
            suite.tests = suite.tests.map(test => {
                const key = `${test.fullTitle}||${test.file}`;
                if (rerunTestMap.has(key)) {
                    replacedCount++;
                    return rerunTestMap.get(key);
                }
                return test;
            });
        }
        if (suite.suites) replaceTests(suite.suites);
    });
}
replaceTests(reportData.results?.[0]?.suites);
console.log(`✅ Đã ghi đè ${replacedCount} test`);

// 5. Tính toán lại stats
console.log('📊 Tính toán lại thống kê...');
let totalTests = 0, passes = 0, failures = 0, pending = 0, duration = 0;

function countStats(suites) {
    if (!suites) return;
    suites.forEach(suite => {
        if (suite.tests) {
            suite.tests.forEach(test => {
                totalTests++;
                if (test.state === 'failed' || (test.err && Object.keys(test.err).length > 0)) failures++;
                else if (test.pending) pending++;
                else passes++;
                if (test.duration) duration += test.duration;
            });
        }
        if (suite.suites) countStats(suite.suites);
    });
}
countStats(reportData.results?.[0]?.suites);

reportData.stats.tests = totalTests;
reportData.stats.passes = passes;
reportData.stats.failures = failures;
reportData.stats.pending = pending;
reportData.stats.duration = duration;
reportData.stats.passPercent = totalTests > 0 ? Number(((passes / totalTests) * 100).toFixed(2)) : 0;

if (reportData.results?.[0]) {
    delete reportData.results[0].stats;
}

if (!reportData.meta) {
    reportData.meta = {};
}
reportData.meta.marge = reportData.meta.marge || {};
reportData.meta.marge.options = {
    reportDir: 'mochawesome-report/all',
    reportFilename: 'full_report_all_ultimate',
    quiet: 'true',
    overwrite: 'true',
    html: 'true',
    json: 'true'
};

// 6. Lưu report cập nhật
fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
console.log(`📝 Report cập nhật: ${totalTests} tests, ${passes} passed, ${failures} failed`);

// 7. Regenerate HTML từ JSON
console.log('\n🎨 Regenerate HTML report...');
const margeCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const margeRun = spawnSync(margeCmd, [
    'marge',
    reportPath,
    '--reportDir', path.join(rootDir, 'mochawesome-report', 'all'),
    '--reportFilename', 'full_report_all_ultimate'
], { cwd: rootDir, stdio: 'inherit', shell: true });

console.log('\n✨ Done! Report updated at mochawesome-report/all/full_report_all_ultimate.html');