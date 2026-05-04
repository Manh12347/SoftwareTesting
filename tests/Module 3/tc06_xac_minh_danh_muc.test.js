const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeCookieBanner } = require('../../function/module3/filterHelper');
const data = require('../../data/data.json');

describe('TC006: Xác minh danh mục sản phẩm hiển thị đầy đủ', function () {
    this.timeout(60000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it('TC006 - Hover vào "Danh mục", xác minh có chữ "Điện thoại"', async function () {
        await driver.get(data.url);
        await closeCookieBanner(driver);

        const danhMucBtn = await driver.wait(
            until.elementLocated(By.xpath(`//button[@aria-label='${data.danhMucAriaLabel}']`)),
            10000
        );
        const actions = driver.actions({ async: true });
        await actions.move({ origin: danhMucBtn }).perform();

        const danhMucItem = await driver.wait(
            until.elementLocated(By.xpath(`//a[@href='${data.danhMucHref}']`)),
            10000
        );
        await driver.wait(until.elementIsVisible(danhMucItem), 5000);
        await driver.executeScript("arguments[0].style.border='3px solid red'", danhMucItem);

        const bodyText = await driver.findElement(By.css('body')).getText();
        assert.ok(bodyText.includes(data.danhMucText), `Text "${data.danhMucText}" không xuất hiện trong danh mục.`);

        let filename = await takeScreenshot(driver, 'TC006');
        addContext(this, "../" + filename);
    });
});
