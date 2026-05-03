const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeCookieBanner } = require('../../function/module2/filterHelper');

describe('TC008: Kiểm tra lọc theo hãng sản xuất', function () {
    this.timeout(60000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it('TC008 - Ấn chọn logo hãng "OPPO"', async function () {
        await driver.get('https://fptshop.com.vn/dien-thoai');

        const oppoLogo = await driver.wait(
            until.elementLocated(By.xpath("//img[@alt='OPPO']")),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", oppoLogo);
        await driver.executeScript("arguments[0].style.border='3px solid red'", oppoLogo);
        await driver.executeScript("arguments[0].click();", oppoLogo);

        await driver.wait(until.elementLocated(By.xpath("//h3")), 10000);

        const bodyText = await driver.findElement(By.tagName('body')).getText();
        assert.ok(bodyText.includes('OPPO'), 'Sản phẩm OPPO không hiển thị sau khi lọc.');

        await closeCookieBanner(driver);
        let filename = await takeScreenshot(driver, 'TC008');
        addContext(this, "../" + filename);
    });
});
