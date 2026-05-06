const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { initializeDriver } = require('../../function/module1/driverManager');
const { openWeb, handleLogin, handleLogout } = require('../../function/module1/function');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC001: Login', function () {
    this.timeout(120000);
    let driver;

    beforeEach(async function () {
        driver = await initializeDriver();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        if (this.currentTest.state === 'failed' && driver) {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc001');
            addContext(this, {
                title: 'Screenshot khi thất bại.',
                value: `../../${screenshotPath}`
            });
        }
        if (driver && this.currentTest.state !== 'failed') {
            try {
                await handleLogout(driver);
            } catch (error) {
                console.log('Không thể đăng xuất tự động sau TC001:', error.message);
            }
        }
        if (driver) {
            await driver.quit();
        }
    });

    it('Đăng nhập thành công', async function () {
        await openWeb(driver);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await handleLogin(driver);

        // Confirm login successful by checking page title
        const pageTitle = await driver.getTitle();
        expect(pageTitle).to.include('Fptshop');

        const screenshotPath = await takeScreenshot(driver, this.test.title, 'tc001');
        addContext(this, {
            title: 'Đăng nhập thành công',
            value: `../../${screenshotPath}`
        });
    });
});
