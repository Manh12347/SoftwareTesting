const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { getPrice, waitForPriceChange, addProductToCart } = require('../../function/module4/cartHelper');

describe('TC018: Chọn dịch vụ đi kèm cùng sản phẩm', function () {
    this.timeout(180000);
    let driver;
    let priceBefore = '0đ';
    let priceAfter  = '0đ';

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();

        // Dùng máy tính xách tay để có dịch vụ bảo hành đi kèm
        await addProductToCart(driver, 'https://fptshop.com.vn/may-tinh-xach-tay');

        // Đọc giá ban đầu trong giỏ hàng
        for (let i = 0; i < 10; i++) {
            priceBefore = await getPrice(driver);
            if (priceBefore !== '0đ') break;
            await driver.sleep(1000);
        }
        console.log(`Giá ban đầu (chưa chọn dịch vụ): ${priceBefore}`);
    });

    afterEach(async function () {
        const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc018');
        addContext(this, {
            title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi',
            value: `../../${screenshotPath}`
        });
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    // --- TEST CASES ---

    it('1. Bấm vào giỏ hàng và xác nhận có sản phẩm', async function () {
        const url = await driver.getCurrentUrl();
        expect(url).to.include('gio-hang', 'Không ở trang giỏ hàng');
        expect(priceBefore).to.not.equal('0đ', 'Giỏ hàng trống hoặc không hiển thị giá');
        console.log(`Giỏ hàng hợp lệ, giá hiện tại: ${priceBefore}`);
    });

    it('2. Chọn dịch vụ đi kèm (gói bảo hành / combo) và kiểm tra giá thay đổi', async function () {
        // Dịch vụ đi kèm trong FPTShop dùng input[type='radio'] với dynamic ID "-undefined"
        const serviceXPaths = [
            "(//input[contains(@id, '-undefined') and @type='radio'])[1]",
            '/html/body/main/section/div[2]/div/div[1]/div/div[2]/div[2]/div[3]/div[2]/div[1]/div/input',
            '/html/body/main/section/div[2]/div/div[1]/div/div[2]/div[2]/div[2]/div[4]/div[1]/div/input',
        ];

        let serviceEl = null;
        for (const xp of serviceXPaths) {
            try {
                serviceEl = await driver.wait(until.elementLocated(By.xpath(xp)), 4000);
                console.log(`Tìm thấy dịch vụ: ${xp.slice(0, 60)}...`);
                break;
            } catch (e) {}
        }

        expect(serviceEl).to.not.equal(null, 'Không tìm thấy dịch vụ đi kèm trong giỏ hàng');

        await driver.executeScript('arguments[0].scrollIntoView({ block: "center" });', serviceEl);
        await driver.sleep(500);

        // Dùng native Selenium click + dispatch React events để toggle radio
        await serviceEl.click();
        await driver.executeScript(`
            const input = arguments[0];
            input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            input.dispatchEvent(new MouseEvent('mouseup',  { bubbles: true }));
            input.dispatchEvent(new MouseEvent('click',    { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        `, serviceEl);
        console.log('Đã click và dispatch events cho dịch vụ đi kèm');
        await driver.sleep(1500);

        // Giá phải thay đổi sau khi chọn dịch vụ
        priceAfter = await waitForPriceChange(driver, priceBefore, 10000);
        console.log(`Giá trước: ${priceBefore} | Giá sau khi chọn dịch vụ: ${priceAfter}`);

        expect(priceAfter).to.not.equal(priceBefore, 'Giá đơn hàng không thay đổi sau khi chọn dịch vụ đi kèm');
    });
});
