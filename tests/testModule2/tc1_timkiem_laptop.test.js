const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { search, closeBanner } = require('../../function/module2/module2Helper');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC1: Tìm kiếm sản phẩm', function () {
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
                value: `../${screenshotPath}`
            });
        }
        if (driver) {
            await driver.quit();
        }
    });

    it('Tìm kiếm với từ khóa "Laptop" - có ít nhất 1 sản phẩm laptop', async function () {
        await driver.get(data.url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await closeBanner(driver);
        await driver.sleep(2000);

        const result = await search(driver, data.testData[0].keyword);

        expect(result.hasProducts).to.be.true;
        
        // KIỂM TRA: Có ít nhất 1 sản phẩm chứa từ khóa "Laptop"
        const keyword = data.testData[0].keyword.toLowerCase();
        const matchedProducts = result.productTexts.filter(p => 
            p.toLowerCase().includes(keyword)
        );
        
        console.log(`Tìm thấy ${matchedProducts.length} sản phẩm chứa "${keyword}":`, matchedProducts);
        
        // Phải có ít nhất 1 sản phẩm chứa từ khóa
        expect(matchedProducts.length, `Không tìm thấy sản phẩm nào chứa "${keyword}"`).to.be.at.least(1);
        
        const screenshotPath = await takeScreenshot(driver, this.test.title);
        addContext(this, {
            title: `Kết quả: ${matchedProducts.length} sản phẩm chứa "${keyword}"`,
            value: `../${screenshotPath}`
        });
    });
});
