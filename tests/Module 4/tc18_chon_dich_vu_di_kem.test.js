const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');

const totalPriceXPath = "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cần thanh toán')]/following-sibling::* | //strong[contains(text(), 'đ') or contains(text(), '₫')] | //span[contains(text(), 'đ') and contains(@class, 'text-red')]";

describe('TC018: Chọn dịch vụ đi kèm cùng sản phẩm', function () {
    this.timeout(180000);
    let driver;
    let priceBefore = '0đ';
    let priceAfter  = '0đ';

    // --- Hàm hỗ trợ ---

    async function getPrice() {
        try {
            const elems = await driver.findElements(By.xpath(totalPriceXPath));
            for (let i = elems.length - 1; i >= 0; i--) {
                const text = (await elems[i].getText()).trim();
                if (/^[0-9.,\s]+[đ₫]$/i.test(text)) return text;
            }
        } catch (e) {}
        return '0đ';
    }

    async function waitForPriceChange(oldPrice, timeout = 10000) {
        let cur = oldPrice;
        try {
            await driver.wait(async () => {
                cur = await getPrice();
                return cur !== oldPrice;
            }, timeout);
            await driver.sleep(500);
            cur = await getPrice();
        } catch (e) {}
        return cur;
    }

    async function addProductToCart() {
        // Dùng máy tính xách tay để có dịch vụ bảo hành đi kèm
        await driver.get('https://fptshop.com.vn/may-tinh-xach-tay');
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await driver.sleep(2000);

        const productXPath = "(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[1]";
        const product = await driver.wait(until.elementLocated(By.xpath(productXPath)), 15000);
        await driver.executeScript('arguments[0].click();', product);
        await driver.sleep(3000);
        await driver.executeScript('window.scrollTo(0, 800);');
        await driver.sleep(1000);

        const buyBtnXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')]";
        try {
            await driver.wait(until.elementLocated(By.xpath(buyBtnXPath)), 10000);
            const btns = await driver.findElements(By.xpath(buyBtnXPath));
            for (let btn of btns) {
                if (await btn.isDisplayed()) {
                    await driver.executeScript('arguments[0].click();', btn);
                    break;
                }
            }
        } catch (e) {}

        await driver.sleep(3000);
        const currentUrl = await driver.getCurrentUrl();
        if (!currentUrl.includes('gio-hang')) {
            await driver.get('https://fptshop.com.vn/gio-hang');
            await driver.wait(until.urlContains('gio-hang'), 10000);
        }
        await driver.sleep(2000);
    }

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
        await addProductToCart();

        // Đọc giá ban đầu trong giỏ hàng
        for (let i = 0; i < 10; i++) {
            priceBefore = await getPrice();
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
        // Đây là pattern giống Chọn tất cả nhưng là radio (không phải checkbox)
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
        priceAfter = await waitForPriceChange(priceBefore, 10000);
        console.log(`Giá trước: ${priceBefore} | Giá sau khi chọn dịch vụ: ${priceAfter}`);

        expect(priceAfter).to.not.equal(priceBefore, 'Giá đơn hàng không thay đổi sau khi chọn dịch vụ đi kèm');
    });
});
