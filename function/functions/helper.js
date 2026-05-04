const { By, until } = require('selenium-webdriver');
const data = require('../../data/data.json');

/**
 * Đóng banner nếu có
 * @param {import('selenium-webdriver').WebDriver} driver
 */
async function closeBanner(driver) {
    try {
        const bannerCloseXPath = data.shared.ui.bannerCloseXPath;
        await driver.wait(until.elementLocated(By.xpath(bannerCloseXPath)), 5000);
        const closeBtn = await driver.findElement(By.xpath(bannerCloseXPath));
        await driver.executeScript('arguments[0].click();', closeBtn);
        await driver.sleep(500);
    } catch (e) {
        // Banner không tồn tại, bỏ qua
    }
}

async function closeCookieBanner(driver) {
    try {
        const acceptCookieXPath = data.shared.ui.acceptCookieXPath;
        const acceptBtn = await driver.wait(
            until.elementLocated(By.xpath(acceptCookieXPath)),
            5000
        );
        await acceptBtn.click();
    } catch (e) {
        // Cookie banner không tồn tại, bỏ qua
    }
}

module.exports = { closeBanner, closeCookieBanner };

