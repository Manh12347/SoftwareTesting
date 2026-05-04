const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');
const {
    QR_CODE_XPATH, DAT_HANG_XPATH,
    waitForBody, findFirstVisible, clickVisible,
    setInputIfPresent, setInputRequired, randomDigits,
    waitForAnyLocated, selectQRPayment,
    waitForGatewaySignal, waitForGatewayAfterPlaceOrder,
    acceptTermsIfPresent, pickRandomStoreFromAddressForm
} = require('../../function/module4/checkoutHelper');
const { quantityInputXPath } = require('../../function/module4/cartHelper');

describe('TC020: Đặt hàng QR code và đợi 15 phút (Kiểm tra hết hạn giao dịch)', function () {
    this.timeout(1200000); // 20 minutes
    let driver;

    // Shared state between test steps
    let gatewayReady = false;

    async function addProductToCart() {
        const categoryUrl = 'https://fptshop.com.vn/may-tinh-xach-tay';
        const cartUrl = 'https://fptshop.com.vn/gio-hang';

        for (let attempt = 1; attempt <= 6; attempt++) {
            await driver.get(categoryUrl);
            await waitForBody(driver, 15000);
            await driver.sleep(1500);

            const productXPath = `(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[${attempt}]`;
            const product = await driver.wait(until.elementLocated(By.xpath(productXPath)), 15000);
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', product);
            await driver.executeScript('arguments[0].click();', product);
            await driver.sleep(2500);
            await driver.executeScript('window.scrollTo(0, 800);');
            await driver.sleep(800);

            const buyNowXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')]";
            const addToCartXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')]";

            let clicked = false;
            const buyEl = await findFirstVisible(driver, buyNowXPath);
            if (buyEl) {
                try { await driver.executeScript('arguments[0].click();', buyEl); } catch (e) { await buyEl.click(); }
                clicked = true;
            } else {
                const addEl = await findFirstVisible(driver, addToCartXPath);
                if (addEl) {
                    try { await driver.executeScript('arguments[0].click();', addEl); } catch (e) { await addEl.click(); }
                    clicked = true;
                }
            }

            if (!clicked) { console.log(`[WARN] attempt ${attempt} failed`); continue; }

            await driver.sleep(2500);
            const goCartXPath = "//a[contains(., 'Đến giỏ hàng') or contains(., 'Xem giỏ hàng')] | //button[contains(., 'Đến giỏ hàng') or contains(., 'Xem giỏ hàng')]";
            const goCartEl = await findFirstVisible(driver, goCartXPath);
            if (goCartEl) { try { await driver.executeScript('arguments[0].click();', goCartEl); } catch (e) { await goCartEl.click(); } await driver.sleep(1500); }

            await driver.get(cartUrl);
            await driver.wait(until.urlContains('gio-hang'), 15000);
            await driver.sleep(1500);

            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            const visibleInputs = [];
            for (const input of inputs) { try { if (await input.isDisplayed()) visibleInputs.push(input); } catch (e) { } }
            if (visibleInputs.length > 0) { console.log(`[OK] attempt ${attempt} success.`); return; }
            console.log(`[WARN] Cart empty (attempt ${attempt}). Trying next...`);
        }
        expect.fail('Giỏ hàng đang trống sau khi thử nhiều sản phẩm');
    }

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc020');
        addContext(this, { title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi', value: `../../${screenshotPath}` });
    });

    after(async function () { if (driver) await driver.quit(); });

    it('1. Đặt hàng bằng QR code và xác nhận cổng thanh toán xuất hiện', async function () {
        await addProductToCart();
        console.log('Đã có sản phẩm trong giỏ hàng.');

        const checkoutBtnXPath = "//button[contains(., 'Xác nhận đơn')] | //button[contains(., 'Tiến hành đặt hàng')] | //button[contains(., 'Đặt hàng')]";
        await clickVisible(driver, expect, checkoutBtnXPath, 15000, 'Tiến hành đặt hàng');
        await driver.sleep(2000);

        const { name, phonePrefix, emailDomain } = data.module4.checkoutData;
        await setInputIfPresent(driver, "//*[@id='order-form']//input[@placeholder='Nhập họ tên'] | //input[contains(@placeholder,'Họ và tên')] | //input[@id='name']", name);
        const phoneXPath = "//input[@placeholder='Số điện thoại' or contains(@placeholder,'Số điện thoại') or @id='phone' or @type='tel'][not(ancestor::*[@id='address-form']) and not(ancestor::div[contains(@class,'fixed')])]";
        await setInputRequired(driver, expect, phoneXPath, `${phonePrefix}${randomDigits(7)}`, 'Số điện thoại', 9);
        const fakeEmail = `automation.${Date.now()}${emailDomain}`;
        await setInputIfPresent(driver, "//input[@type='email' or contains(@placeholder,'Email')][not(ancestor::div[contains(@class,'fixed')])]", fakeEmail);
        await driver.sleep(800);

        const atStoreXPath = "//label[contains(., 'Nhận tại cửa hàng')] | //span[contains(., 'Nhận tại cửa hàng')]";
        await clickVisible(driver, expect, atStoreXPath, 15000, 'Nhận tại cửa hàng');
        await driver.sleep(1200);
        const addressFormReady = await waitForAnyLocated(driver, ["//*[@id='address-form']"], 15000);
        expect(addressFormReady, 'Không thấy form chọn cửa hàng').to.not.equal(null);
        const pickedStore = await pickRandomStoreFromAddressForm(driver, expect, 25000);
        expect(pickedStore, 'Không chọn được shop có hàng gần nhất').to.equal(true);

        await selectQRPayment(driver, 20000);
        await driver.sleep(500);

        const nextBtn = await findFirstVisible(driver, "/html/body/main/section/div/div[2]/div[2]/div/div/button");
        if (nextBtn) {
            let btnText = ''; try { btnText = (await nextBtn.getText()).trim(); } catch (e) { }
            if (!/đặt hàng|hoàn tất|thanh toán/i.test(btnText)) {
                try { await driver.executeScript('arguments[0].click();', nextBtn); } catch (e) { await nextBtn.click(); }
                await driver.sleep(1200);
                await selectQRPayment(driver, 15000);
                await driver.sleep(500);
            }
        }

        const finishBtnXPath = `${DAT_HANG_XPATH} | //button[contains(., 'Hoàn tất đặt hàng')] | //button[contains(., 'Đặt hàng')]`;
        const beforePlaceUrl = await driver.getCurrentUrl();
        await acceptTermsIfPresent(driver);

        const exactDatHang = await findFirstVisible(driver, DAT_HANG_XPATH);
        if (exactDatHang) {
            try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', exactDatHang); } catch (e) { }
            try { await exactDatHang.click(); } catch (e1) {
                try { await driver.actions({ async: true }).move({ origin: exactDatHang }).click().perform(); } catch (e2) { await driver.executeScript('arguments[0].click();', exactDatHang); }
            }
        } else {
            await clickVisible(driver, expect, finishBtnXPath, 20000, 'Đặt hàng');
        }

        console.log('Đã nhấn Hoàn tất đặt hàng. Chờ cổng thanh toán...');
        const progressed = await waitForGatewayAfterPlaceOrder(driver, beforePlaceUrl, 90000);
        expect(progressed, 'Không thấy trang/QR thanh toán sau khi đặt hàng').to.not.equal(null);

        const gatewayUrl = await driver.getCurrentUrl();
        const okGateway = await waitForGatewaySignal(driver, 20000);
        expect(okGateway, 'Không thấy UI QR/cổng thanh toán sau 20s').to.equal(true);
        await driver.sleep(3000); // Đợi thêm để QR code/UI render hoàn toàn trước khi chụp screenshot

        console.log('✅ Xác nhận: Cổng thanh toán QR đã xuất hiện. URL: ' + gatewayUrl);
        gatewayReady = true;
    });

    it('2. Chờ thông báo hết hạn giao dịch xuất hiện', async function () {
        expect(gatewayReady, 'Bước 1 chưa hoàn thành – cổng thanh toán chưa sẵn sàng').to.equal(true);

        const timeoutModalBtnXPath = "/html/body/div[7]/div[1]/div[3]/div/button[1]";
        console.log('Đang chờ thông báo hết hạn giao dịch (tối đa 16 phút)...');

        let timeoutModalVisible = false;
        try {
            // Chờ cho đến khi nút trong hộp thoại thông báo xuất hiện (timeout 16 phút)
            await driver.wait(until.elementLocated(By.xpath(timeoutModalBtnXPath)), 960000);
            const modalBtn = await findFirstVisible(driver, timeoutModalBtnXPath);
            timeoutModalVisible = !!modalBtn;
        } catch (e) {
            console.log('[WARN] Quá thời gian chờ hoặc không thấy thông báo hết hạn.');
        }

        expect(timeoutModalVisible, 'Thông báo hết hạn giao dịch KHÔNG xuất hiện').to.equal(true);
        console.log('✅ Xác nhận: Thông báo hết hạn QR đã xuất hiện.');
    });

    it('3. Xác nhận trang kết quả sau khi hết hạn giao dịch', async function () {
        expect(gatewayReady, 'Bước 1 chưa hoàn thành – không thể tiếp tục').to.equal(true);

        const timeoutModalBtnXPath = "/html/body/div[7]/div[1]/div[3]/div/button[1]";
        try {
            const modalBtn = await findFirstVisible(driver, timeoutModalBtnXPath);
            if (modalBtn) {
                console.log('Nhấn nút "Hủy bỏ" trên hộp thoại hết hạn...');
                try { await driver.executeScript('arguments[0].click();', modalBtn); } catch (e) { await modalBtn.click(); }
                await driver.sleep(2000);
            }
        } catch (e) {
            console.log('[INFO] Hộp thoại đã đóng hoặc không tìm thấy.');
        }

        await driver.navigate().refresh();
        await driver.sleep(3000);
        const urlFinal = await driver.getCurrentUrl();
        console.log('✅ URL trang kết quả sau khi hết hạn: ' + urlFinal);
    });
});
