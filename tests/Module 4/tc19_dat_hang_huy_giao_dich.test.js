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
    acceptTermsIfPresent, pickRandomStoreFromAddressForm,
    tryCancelOnGateway, assertPaymentFailedOrUnpaid
} = require('../../function/module4/checkoutHelper');
const { quantityInputXPath } = require('../../function/module4/cartHelper');

describe('TC019: Đặt hàng, hủy giao dịch Chuyển khoản ngân hàng (QR code)', function () {
    this.timeout(300000);
    let driver;

    // Shared state between test steps
    let originalHandle;
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
        const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc019');
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
        originalHandle = await driver.getWindowHandle();
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

        const handles = await driver.getAllWindowHandles();
        if (handles.length > 1) {
            const next = handles.find(h => h !== originalHandle);
            if (next) { await driver.switchTo().window(next); await driver.sleep(1000); }
        }

        const gatewayUrl = await driver.getCurrentUrl();
        expect(gatewayUrl.includes('gio-hang')).to.equal(false, 'Vẫn ở trang giỏ hàng sau khi đặt hàng');
        const okGateway = await waitForGatewaySignal(driver, 20000);
        expect(okGateway, 'Không thấy UI QR/cổng thanh toán sau 20s').to.equal(true);
        await driver.sleep(3000); // Đợi thêm để QR code/UI render hoàn toàn trước khi chụp screenshot

        console.log('✅ Xác nhận: Cổng thanh toán QR đã xuất hiện. URL: ' + gatewayUrl);
        gatewayReady = true; // Signal to next step that gateway is ready
    });

    it('2. Hủy giao dịch và xác nhận hộp thoại xác nhận hủy xuất hiện', async function () {
        expect(gatewayReady, 'Bước 1 chưa hoàn thành – cổng thanh toán chưa sẵn sàng').to.equal(true);

        // Click "Hủy giao dịch" trên trang QR
        const canceled = await tryCancelOnGateway(driver);
        console.log(canceled ? 'Đã click nút Hủy giao dịch.' : '[WARN] Không tìm thấy nút Hủy.');

        // Xác nhận hộp thoại xác nhận xuất hiện (đây là kết quả kỳ vọng — chụp ảnh làm bằng chứng)
        // Thử cả div[6] và div[7] để tăng độ ổn định
        const confirmModalBtnXPath = "(/html/body/div[6]/div[1]/div[3]/div/button[2] | /html/body/div[7]/div[1]/div[3]/div/button[2])[1]";
        let confirmModalVisible = false;
        try {
            await driver.wait(until.elementLocated(By.xpath(confirmModalBtnXPath)), 10000);
            const confirmBtn = await findFirstVisible(driver, confirmModalBtnXPath);
            confirmModalVisible = !!confirmBtn;
        } catch (e) {
            console.log('[INFO] Không thấy hộp thoại xác nhận hủy.');
        }

        expect(confirmModalVisible, 'Hộp thoại xác nhận hủy giao dịch KHÔNG xuất hiện').to.equal(true);
        console.log('✅ Xác nhận: Hộp thoại "Xác nhận hủy giao dịch" đã xuất hiện.');
    });

    it('3. Xác nhận hủy và kiểm tra trạng thái thanh toán thất bại', async function () {
        expect(gatewayReady, 'Bước 1 chưa hoàn thành – không thể tiếp tục').to.equal(true);

        const confirmCancelXPath = "(/html/body/div[6]/div[1]/div[3]/div/button[2] | /html/body/div[7]/div[1]/div[3]/div/button[2])[1]";
        try {
            const confirmBtn = await findFirstVisible(driver, confirmCancelXPath);
            if (confirmBtn) {
                console.log('Nhấn "Xác nhận" để đồng ý hủy giao dịch...');
                try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', confirmBtn); } catch (e) { }
                await driver.sleep(500);
                try {
                    await confirmBtn.click();
                } catch (e1) {
                    try {
                        await driver.actions({ async: true }).move({ origin: confirmBtn }).click().perform();
                    } catch (e2) {
                        await driver.executeScript('arguments[0].click();', confirmBtn);
                    }
                }
                await driver.sleep(2000);
            }
        } catch (e) {
            console.log('[INFO] Hộp thoại không còn hiển thị hoặc lỗi click:', e.message);
        }

        // Chờ điều hướng về trang kết quả đơn hàng
        const beforeCancelUrl = await driver.getCurrentUrl();
        await driver.wait(async () => {
            const url = await driver.getCurrentUrl();
            if (url !== beforeCancelUrl) return true;
            const failText = await findFirstVisible(driver, "//*[contains(., 'thất bại') or contains(., 'chưa thanh toán') or contains(., 'không thành công')]");
            return !!failText;
        }, 60000);
        await driver.sleep(2000);

        console.log('URL trang kết quả: ' + await driver.getCurrentUrl());
        await assertPaymentFailedOrUnpaid(driver, expect);
        console.log('✅ Xác nhận: Trạng thái thanh toán là Thất bại / Chưa thanh toán.');
    });
});
