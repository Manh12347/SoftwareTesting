const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const data = require('../../data/data.json');

describe('TC009: Kiểm tra lọc đa điều kiện', function () {
    this.timeout(120000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it(`TC009 - Chọn Pin trâu: trên 5500 mAh, RAM ${data.module3.filterRam}, Hỗ trợ mạng ${data.module3.filter5G}`, async function () {
        await driver.get(data.shared.urlDienThoai);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        const pinCheckbox = await driver.wait(
            until.elementLocated(By.xpath(`//label[contains(@for, '${data.module3.filterPin}')]`)),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", pinCheckbox);
        await driver.executeScript("arguments[0].click();", pinCheckbox);
        await driver.sleep(1500);

        const btn5G = await driver.wait(
            until.elementLocated(By.xpath(`//button[contains(text(),'${data.module3.filter5G}')]`)),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", btn5G);
        await driver.executeScript("arguments[0].click();", btn5G);
        await driver.sleep(1500);

        const ramBtn = await driver.wait(
            until.elementLocated(By.xpath(`//button[normalize-space()='${data.module3.filterRam}']`)),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", ramBtn);
        await driver.executeScript("arguments[0].click();", ramBtn);
        await driver.sleep(2000);

        const bodyText = await driver.findElement(By.css('body')).getText();
        assert.ok(bodyText.includes(data.module3.filter5G), `Không hiển thị sản phẩm ${data.module3.filter5G} sau khi lọc đa điều kiện.`);

        let filename = await takeScreenshot(driver, 'TC009');
        addContext(this, "../../" + filename);
    });
});
