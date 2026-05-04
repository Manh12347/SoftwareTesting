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
    // Tạo tên file hợp lệ - chỉ loại bỏ các ký tự không hợp lệ trong đường dẫn
    // Thay khoảng trắng bằng dấu gạch dưới, loại bỏ chỉ ký tự đặc biệt nguy hiểm
    const sanitizedTitle = testTitle
        .replace(/[\\/:"*?<>|]/g, '') // Loại bỏ ký tự không hợp lệ
        .replace(/\s+/g, '_')         // Thay khoảng trắng bằng _
        .substring(0, 50);             // Giới hạn độ dài
    
    const fileName = `${sanitizedTitle}_${Date.now()}.png`;
    const screenshotDir = path.join('screenshots', subDir).replace(/\\/g, '/');
    const screenshotPath = path.join(screenshotDir, fileName).replace(/\\/g, '/');
    const mirroredScreenshotDir = path.join('mochawesome-report', 'screenshots', subDir).replace(/\\/g, '/');
    const mirroredScreenshotPath = path.join(mirroredScreenshotDir, fileName).replace(/\\/g, '/');

    // Đảm bảo thư mục screenshots tồn tại
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(mirroredScreenshotDir, { recursive: true });

    // Chụp ảnh và lưu file
    const image = await driver.takeScreenshot();
    fs.writeFileSync(screenshotPath, image, 'base64');
    fs.writeFileSync(mirroredScreenshotPath, image, 'base64');

    console.log(`Screenshot saved to: ${screenshotPath}`);
    return screenshotPath; // Trả về đường dẫn tương đối
}

module.exports = { takeScreenshot, search };
