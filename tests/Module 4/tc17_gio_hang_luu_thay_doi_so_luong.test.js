const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const {
    getPrice,
    waitForPriceChange,
    addProductToCart,
    setQuantityOnInput,
    quantityInputXPath
} = require('../../function/module4/cartHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');

// 3 sản phẩm từ 3 danh mục khác nhau để thêm vào giỏ
const targetProducts = [
    { name: 'Điện thoại', url: 'https://fptshop.com.vn/dien-thoai' },
    { name: 'Máy tính xách tay', url: 'https://fptshop.com.vn/may-tinh-xach-tay' },
    { name: 'Máy tính bảng', url: 'https://fptshop.com.vn/may-tinh-bang' },
];

// 3 iterations với số lượng khác nhau
const quantityIterations = [10, 1000, 100000];

quantityIterations.forEach((targetQty, iterIdx) => {
    describe(`TC017: Giỏ hàng lưu thay đổi số lượng - Iteration ${iterIdx + 1} (Số lượng: ${targetQty.toLocaleString()})`, function () {
        this.timeout(300000);
        let driver;
   
        before(async function () {
            driver = await new Builder().forBrowser('chrome').build();
            await driver.manage().window().maximize();

            // Thêm lần lượt 3 sản phẩm khác nhau vào giỏ hàng
            for (const product of targetProducts) {
                console.log(`Đang thêm: ${product.name}`);
                await addProductToCart(driver, product.url);
                // After each product, if redirected to cart, go back to allow adding the next one
                const url = await driver.getCurrentUrl();
                if (url.includes('gio-hang')) {
                    await driver.navigate().back();
                    await driver.sleep(1000);
                }
            }

            // Vào trang giỏ hàng để bắt đầu test
            await driver.get('https://fptshop.com.vn/gio-hang');
            await driver.wait(until.urlContains('gio-hang'), 10000);

            // Đóng banner/cookie nếu xuất hiện ngay khi trang giỏ hàng load
            await closeBanner(driver);
            await closeCookieBanner(driver);

            await driver.sleep(2000);

            console.log(`[Setup] Đã thêm ${targetProducts.length} sản phẩm vào giỏ. Bắt đầu iteration số lượng: ${targetQty}`);
        });

        afterEach(async function () {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc017');
            addContext(this, {
                title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi',
                value: `../../${screenshotPath}`
            });
        });

        after(async function () {
            if (driver) await driver.quit();
        });

        // --- TEST CASES ---

        it(`1. Thay đổi số lượng tất cả sản phẩm thành ${targetQty.toLocaleString()}`, async function () {
            await closeBanner(driver);
            await closeCookieBanner(driver);
            // Bước 1: Click "Chọn tất cả"
            const selectAllXPath = "//input[contains(@id, '-undefined')] | //label[contains(., 'Chọn tất cả')] | //span[contains(text(), 'Chọn tất cả')]";
            try {
                const selectAllEl = await driver.wait(until.elementLocated(By.xpath(selectAllXPath)), 5000);
                await driver.executeScript('arguments[0].scrollIntoView({ block: "center" });', selectAllEl);
                await driver.executeScript('arguments[0].click();', selectAllEl);
                await driver.sleep(1000);
                console.log('Đã click "Chọn tất cả"');
            } catch (e) {
                console.log('[WARN] Không tìm thấy nút "Chọn tất cả": ' + e.message);
            }

            // Bước 2: Lấy tất cả input số lượng trong giỏ hàng
            await driver.sleep(500);
            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            const visibleInputs = [];
            for (let input of inputs) {
                try { if (await input.isDisplayed()) visibleInputs.push(input); } catch (e) { }
            }

            expect(visibleInputs.length).to.be.at.least(1, 'Không tìm thấy sản phẩm nào trong giỏ hàng');
            console.log(`Tìm thấy ${visibleInputs.length} sản phẩm trong giỏ hàng`);

            // Bước 3: Cập nhật số lượng từng sản phẩm một
            for (let i = 0; i < visibleInputs.length; i++) {
                const priceBefore = await getPrice(driver);
                const accepted = await setQuantityOnInput(driver, visibleInputs[i], targetQty);
                await waitForPriceChange(driver, priceBefore, 15000);

                console.log(`Sản phẩm ${i + 1}: đặt ${targetQty} -> UI ghi nhận ${accepted}`);
                if (accepted !== String(targetQty)) {
                    console.log(`  [WARN] Sản phẩm ${i + 1} không nhận đúng giá trị (có thể bị giới hạn tồn kho)`);
                }
            }

            // Xác nhận giá đã thay đổi
            const finalPrice = await getPrice(driver);
            expect(finalPrice).to.not.equal('0đ', 'Giỏ hàng không hiển thị giá sau khi thay đổi số lượng');
        });

        it('2. Về trang chủ rồi quay lại giỏ hàng', async function () {
            await driver.get('https://fptshop.com.vn');
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
            await driver.sleep(2000);

            const homeUrl = await driver.getCurrentUrl();
            expect(homeUrl).to.include('fptshop.com.vn', 'Không điều hướng được về trang chủ');
            console.log(`Đã về trang chủ: ${homeUrl}`);

            await driver.get('https://fptshop.com.vn/gio-hang');
            await driver.wait(until.urlContains('gio-hang'), 10000);
            await driver.sleep(2000);

            const cartUrl = await driver.getCurrentUrl();
            expect(cartUrl).to.include('gio-hang', 'Không điều hướng được vào giỏ hàng');
            console.log(`Đã quay lại giỏ hàng: ${cartUrl}`);
        });

        it(`3. Kiểm tra số lượng sản phẩm đã được lưu là ${targetQty.toLocaleString()}`, async function () {
            await driver.wait(until.elementLocated(By.xpath(quantityInputXPath)), 15000, 'Giỏ hàng không hiển thị sản phẩm sau khi reload');
            await driver.sleep(1000);

            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            const visibleInputs = [];
            for (let input of inputs) {
                try { if (await input.isDisplayed()) visibleInputs.push(input); } catch (e) { }
            }

            expect(visibleInputs.length).to.be.at.least(1, 'Giỏ hàng trống sau khi quay lại - dữ liệu không được lưu');

            let savedCount = 0;
            let notSavedList = [];

            for (let i = 0; i < visibleInputs.length; i++) {
                const actualVal = parseInt(await visibleInputs[i].getAttribute('value'));
                console.log(`Sản phẩm ${i + 1}: Giá trị lưu = ${actualVal}, Mong đợi = ${targetQty}`);
                if (actualVal === targetQty) {
                    savedCount++;
                } else {
                    notSavedList.push(`Sản phẩm ${i + 1}: lưu ${actualVal}, mong đợi ${targetQty}`);
                }
            }

            if (notSavedList.length > 0) {
                expect.fail(
                    `Giỏ hàng KHÔNG lưu đúng số lượng sau khi điều hướng đi và quay lại:\n` +
                    notSavedList.join('\n') +
                    `\n(${savedCount}/${visibleInputs.length} sản phẩm được lưu đúng)`
                );
            } else {
                console.log(`✓ Tất cả ${visibleInputs.length} sản phẩm đều lưu đúng số lượng ${targetQty}`);
            }
        });
    });
});
