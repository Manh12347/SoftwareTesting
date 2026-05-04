const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { search } = require('../../function/module2/module2Helper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC12: Tìm kiếm không có kết quả', function () {
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

    it('Tìm kiếm với từ khóa "123123" - hiển thị thông báo không tìm thấy', async function () {
        await driver.get(data.shared.url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        const result = await search(driver, data.module2.testData[1].keyword);

        expect(result.found).to.be.false;
        if (result.message) {   
            expect(result.message).to.include('Không tìm thấy');
        }

        const screenshotPath = await takeScreenshot(driver, this.test.title);
        addContext(this, {
            title: 'Thông báo: ' + (result.message || 'Không tìm thấy'),
            value: `../../${screenshotPath}`
        }); 
    });
});
