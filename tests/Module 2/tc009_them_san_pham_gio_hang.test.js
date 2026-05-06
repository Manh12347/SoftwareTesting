const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC009: Thêm sản phẩm vào giỏ hàng', function () {
    this.timeout(90000);
    let driver;

    beforeEach(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        if (this.currentTest.state === 'failed') {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc009');
            addContext(this, {
                title: 'Screenshot khi thất bại.',
                value: `../${screenshotPath}`
            });
        }
        if (driver) {
            await driver.quit();
        }
    });

    it('Thêm sản phẩm vào giỏ hàng thành công', async function () {
        await driver.get(data.shared.url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        // Bước 1: Click vào sản phẩm trên trang chủ
        // XPath nâng cao: tìm sản phẩm
        const productXPath = "//h3[contains(@class,'line-clamp')]";
        const productElement = await driver.wait(
            until.elementLocated(By.xpath(productXPath)),
            10000,
            'Không tìm thấy sản phẩm'
        );
        const productName = await productElement.getText();
        console.log('Product clicked:', productName);
        await driver.executeScript('arguments[0].click();', productElement);

        // Bước 2: Đợi URL thay đổi sang trang detail
        await driver.wait(function() {
            return driver.getCurrentUrl().then(function(url) {
                return url.includes('/p/') || url.includes('product') || url !== data.shared.url;
            });
        }, 10000, 'Không chuyển sang trang detail');
        
        const firstWord = productName.split(' ')[0];
        const detailTitleXPath = `//h1[contains(text(),'${firstWord}')]`;
        await driver.wait(until.elementLocated(By.xpath(detailTitleXPath)), 10000, 'Title không load');
        
        const detailTitle = await driver.findElement(By.xpath(detailTitleXPath));
        const detailProductName = await detailTitle.getText();
        console.log('Detail product name:', detailProductName);

        // Bước 3: Click nút thêm vào giỏ hàng
        // XPath nâng cao: tìm button Thêm
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
        await driver.sleep(500);

        const addButtonXPath = "//button[@aria-label='Thêm sản phẩm vào giỏ hàng']";
        const addButton = await driver.wait(until.elementLocated(By.xpath(addButtonXPath)), 10000, 'Không tìm thấy nút thêm');
        await driver.executeScript('arguments[0].click();', addButton);
        console.log('Clicked add to cart button');

        // Bước 4: Click vào giỏ hàng
        // XPath nâng cao: tìm link giỏ hàng
        const cartLinkXPath = "//a[@aria-label='giỏ hàng']";
        const cartLink = await driver.wait(
            until.elementLocated(By.xpath(cartLinkXPath)),
            5000,
            'Không tìm thấy giỏ hàng'
        );
        await driver.executeScript('arguments[0].click();', cartLink);

        // Bước 5: Verify sản phẩm trong giỏ hàng
        // XPath nâng cao: tìm sản phẩm trong giỏ
        const cartProductXPath = `//span[contains(@title,'${detailProductName}')]`;
        let productInCart = false;
        
        try {
            await driver.wait(until.elementLocated(By.xpath(cartProductXPath)), 5000);
            productInCart = true;
            console.log('Product found in cart');

            const quantityInput = await driver.findElement(
                By.xpath(`//span[contains(@title,'${detailProductName}')]/ancestor::div[contains(@class,'item')]//input[@type='number']`)
            );
            const quantity = await quantityInput.getAttribute('value');
            console.log('Quantity:', quantity);
            expect(quantity).to.equal('1');
        } catch (e) {
            console.log('Product not found in cart');
        }

        expect(productInCart).to.be.true;

        const screenshotPath = await takeScreenshot(driver, this.test.title, 'tc009');
        addContext(this, {
            title: 'Thêm sản phẩm vào giỏ hàng thành công',
            value: `../../${screenshotPath}`
        });
    });
});
