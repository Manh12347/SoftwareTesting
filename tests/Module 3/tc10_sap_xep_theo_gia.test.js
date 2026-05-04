const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const data = require('../../data/data.json');

describe('TC010: Kiểm tra sắp xếp sản phẩm theo giá', function () {
    this.timeout(60000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it(`TC010 - Nhấn "${data.module3.sortText}" - sản phẩm hiển thị đúng thứ tự`, async function () {
        await driver.get(data.shared.urlDienThoai);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        const sortBtn = await driver.wait(
            until.elementLocated(By.xpath(`//span[contains(text(),'${data.module3.sortText}')]`)),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", sortBtn);
        await driver.executeScript("arguments[0].style.border='3px solid red'", sortBtn);
        await driver.executeScript("arguments[0].click();", sortBtn);

        await driver.wait(until.elementLocated(By.xpath("//h3")), 10000);

        const bodyText = await driver.findElement(By.css('body')).getText();
        assert.ok(bodyText.includes(data.module3.sortText), `Không hiển thị sắp xếp "${data.module3.sortText}".`);

        let filename = await takeScreenshot(driver, 'TC010');
        addContext(this, "../../" + filename);
    });
});
