const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeCookieBanner } = require('../../function/module2/filterHelper');

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

    it('TC010 - Nhấn "Giá giảm dần" - sản phẩm hiển thị đúng thứ tự', async function () {
        await driver.get('https://fptshop.com.vn/dien-thoai');

        const sortBtn = await driver.wait(
            until.elementLocated(By.xpath("//div[@class='mb-2 flex w-full items-center mb:mt-5 mt-4 pc:my-5 justify-between']//span[contains(text(),'Giá giảm dần')]")),
            10000
        );
        await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", sortBtn);
        await driver.executeScript("arguments[0].style.border='3px solid red'", sortBtn);
        await driver.executeScript("arguments[0].click();", sortBtn);

        await driver.wait(until.elementLocated(By.xpath("//h3")), 10000);

        const bodyText = await driver.findElement(By.tagName('body')).getText();
        assert.ok(bodyText.includes('Giá giảm dần'), 'Không hiển thị sắp xếp "Giá giảm dần".');

        await closeCookieBanner(driver);
        let filename = await takeScreenshot(driver, 'TC010');
        addContext(this, "../" + filename);
    });
});
