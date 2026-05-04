const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { search } = require('../../function/module2/module2Helper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC13: Validation tìm kiếm', function () {
    this.timeout(60000);
    let driver;

    beforeEach(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        if (this.currentTest.state === 'failed') {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title);
            addContext(this, {
                title: 'Screenshot khi thất bại.',
                value: `../../${screenshotPath}`
            });
        }
        if (driver) {
            await driver.quit();
        }
    });

    it('Click vào ô tìm kiếm rồi bấm nút tìm kiếm - kiểm tra thông báo validation', async function () {
        await driver.get(data.shared.url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        const result = await search(driver, data.module2.testData[2].keyword);

        if (result.validationMessage) {
            expect(result.validationMessage).to.match(/nhập|vui lòng|cần|tìm kiếm/i);
        } else {
            throw new Error('BUG: Website không hiển thị thông báo "Vui lòng nhập từ khóa" khi bỏ trống ô tìm kiếm');
        }

        const screenshotPath = await takeScreenshot(driver, this.test.title);
        addContext(this, {
            title: 'Thông báo: ' + result.validationMessage,
            value: `../../${screenshotPath}`
        });
    });
});
