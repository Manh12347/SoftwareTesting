const fs = require('fs');
const path = require('path');
const { By, until } = require('selenium-webdriver');

const { search } = require('./module2/module2Helper');

function normalizeTcCode(value) {
    const match = String(value || '').match(/TC0*(\d+)/i);
    if (!match) {
        return '';
    }

    return `TC${match[1].padStart(3, '0')}`;
}

/**
 * Chụp ảnh màn hình và lưu vào thư mục 'screenshots' ở root repo.
 * Trả về đường dẫn tương đối dùng trong báo cáo (vd: 'screenshots/tc016/img.png').
 */
async function takeScreenshot(driver, testTitle, subDir = '') {
    const tcCodeFromTitle = normalizeTcCode(testTitle);
    const tcCodeFromDir = normalizeTcCode(subDir);
    const tcCode = tcCodeFromTitle || tcCodeFromDir;
    const tcPrefix = tcCode ? `${tcCode}_` : '';
    const screenshotSubDir = tcCodeFromDir ? tcCodeFromDir.toLowerCase() : String(subDir || '').toLowerCase();
    const titleWithoutTcPrefix = String(testTitle || '')
        .replace(/^\s*TC0*\d+\s*[:\-–—]?\s*/i, '');

    const sanitizedTitle = titleWithoutTcPrefix
        .replace(/[\\/:"*?<>|]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);

    const fileName = `${tcPrefix}${sanitizedTitle}_${Date.now()}.png`;

    // Xác định root của repo (một thư mục lên từ function/)
    const repoRoot = path.resolve(__dirname, '..');

    const screenshotDirAbs = path.join(repoRoot, 'screenshots', screenshotSubDir);
    const mirroredDirAbs = path.join(repoRoot, 'mochawesome-report', 'screenshots', screenshotSubDir);

    const screenshotPathAbs = path.join(screenshotDirAbs, fileName);
    const mirroredPathAbs = path.join(mirroredDirAbs, fileName);

    const screenshotPathRel = path.join('screenshots', screenshotSubDir, fileName).replace(/\\/g, '/');

    fs.mkdirSync(screenshotDirAbs, { recursive: true });
    fs.mkdirSync(mirroredDirAbs, { recursive: true });

    const image = await driver.takeScreenshot();
    fs.writeFileSync(screenshotPathAbs, image, 'base64');
    fs.writeFileSync(mirroredPathAbs, image, 'base64');

    console.log(`Screenshot saved to: ${screenshotPathAbs}`);
    return screenshotPathRel;
}

module.exports = { takeScreenshot, search };
