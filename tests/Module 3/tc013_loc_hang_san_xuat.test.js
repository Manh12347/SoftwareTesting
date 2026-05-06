const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const data = require('../../data/data.json');

describe('TC013: Kiểm tra lọc theo hãng sản xuất', function () {
    this.timeout(60000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it(`TC013 - Ấn chọn logo hãng "${data.module3.brandName}"`, async function () {
        await driver.get(data.shared.urlDienThoai);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        const brandLogo = await driver.wait(
            until.elementLocated(By.xpath(`//img[@alt='${data.module3.brandName}']`)),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", brandLogo);
        await driver.executeScript("arguments[0].style.border='3px solid red'", brandLogo);
        await driver.executeScript("arguments[0].click();", brandLogo);

        await driver.wait(until.elementLocated(By.xpath("//h3")), 10000);

        const bodyText = await driver.findElement(By.css('body')).getText();
        assert.ok(bodyText.includes(data.module3.brandName), `Sản phẩm ${data.module3.brandName} không hiển thị sau khi lọc.`);

        let filename = await takeScreenshot(driver, this.test.title, 'tc013');
        addContext(this, "../../" + filename);
    });
});
