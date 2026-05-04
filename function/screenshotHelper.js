const fs = require('fs');
const path = require('path');
const { By, until } = require('selenium-webdriver');

const { search } = require('./module2/module2Helper');

/**
 * Chụp ảnh màn hình và lưu vào thư mục 'screenshots'.
 * Đảm bảo thư mục tồn tại trước khi lưu.
 * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance.
 * @param {string} testTitle - Tiêu đề của test case, dùng để đặt tên file.
 * @returns {Promise<string>} - Trả về đường dẫn tương đối của file ảnh đã lưu.
 */
async function takeScreenshot(driver, testTitle, subDir = '') {
    // Tạo tên file hợp lệ từ tiêu đề test
    const sanitizedTitle = testTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedTitle}_${Date.now()}.png`;
    const screenshotDir = path.join('screenshots', subDir).replace(/\\/g, '/');
    const screenshotPath = path.join(screenshotDir, fileName).replace(/\\/g, '/');

    // Đảm bảo thư mục screenshots tồn tại
    fs.mkdirSync(screenshotDir, { recursive: true });

    // Chụp ảnh và lưu file
    const image = await driver.takeScreenshot();
    fs.writeFileSync(screenshotPath, image, 'base64');

    console.log(`Screenshot saved to: ${screenshotPath}`);
    return screenshotPath; // Trả về đường dẫn tương đối
}

module.exports = { takeScreenshot, search };
