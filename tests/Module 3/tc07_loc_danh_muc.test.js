const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const data = require('../../data/data.json');

describe('TC007: Kiểm tra lọc sản phẩm theo danh mục', function () {
    this.timeout(60000);
    let driver;

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it('TC007 - Hover vào "Danh mục" rồi click "Điện thoại"', async function () {
        await driver.get(data.shared.url);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        // Hover vào nút Danh mục
        const danhMucBtn = await driver.wait(
            until.elementLocated(By.xpath(`//button[@aria-label='${data.module3.danhMucAriaLabel}']`)),
            10000
        );
        await driver.actions({ async: true }).move({ origin: danhMucBtn }).perform();

        // Click vào item Điện thoại trong dropdown
        const danhMucItem = await driver.wait(
            until.elementLocated(By.xpath(`//a[@href='${data.module3.danhMucHref}']`)),
            10000
        );
        await driver.executeScript("arguments[0].style.border='3px solid red'", danhMucItem);
        await danhMucItem.click();

        // Xác minh đã vào đúng trang Điện thoại
        await driver.wait(until.urlIs(data.shared.urlDienThoai), 10000);

        const bodyText = await driver.findElement(By.css('body')).getText();
        assert.ok(bodyText.includes(data.module3.danhMucText), `Trang danh mục "${data.module3.danhMucText}" không hiển thị.`);

        const filename = await takeScreenshot(driver, 'TC007');
        addContext(this, '../../' + filename);
    });
});
