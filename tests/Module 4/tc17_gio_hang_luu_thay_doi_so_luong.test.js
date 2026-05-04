const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');

// 3 sản phẩm từ 3 danh mục khác nhau để thêm vào giỏ
const targetProducts = [
    { name: 'Điện thoại', url: 'https://fptshop.com.vn/dien-thoai' },
    { name: 'Máy tính xách tay', url: 'https://fptshop.com.vn/may-tinh-xach-tay' },
    { name: 'Máy tính bảng', url: 'https://fptshop.com.vn/may-tinh-bang' },
];

// 3 iterations với số lượng khác nhau
const quantityIterations = [10, 1000, 100000];

const quantityInputXPath = "//input[@min='1'] | //input[contains(@class, 'text-center') and @type='text']";
const totalPriceXPath = "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cần thanh toán')]/following-sibling::* | //div[contains(@class, 'cart-summary')]//strong | //strong[contains(text(), 'đ') or contains(text(), '₫')] | //span[contains(text(), 'đ') and contains(@class, 'text-red')]";

quantityIterations.forEach((targetQty, iterIdx) => {
    describe(`TC017: Giỏ hàng lưu thay đổi số lượng - Iteration ${iterIdx + 1} (Số lượng: ${targetQty.toLocaleString()})`, function () {
        this.timeout(300000);
        let driver;

        // --- Hàm hỗ trợ ---

        async function getPrice() {
            try {
                const priceElems = await driver.findElements(By.xpath(totalPriceXPath));
                for (let i = priceElems.length - 1; i >= 0; i--) {
                    let text = (await priceElems[i].getText()).trim();
                    if (/^[0-9.,\s]+[đ₫]$/i.test(text)) return text;
                }
            } catch (e) { }
            return '0đ';
        }

        async function waitForPriceChange(oldPrice, timeout = 15000) {
            let currentPrice = oldPrice;
            try {
                await driver.wait(async () => {
                    currentPrice = await getPrice();
                    return currentPrice !== oldPrice;
                }, timeout);
                await driver.sleep(500);
                currentPrice = await getPrice();
            } catch (e) { }
            return currentPrice;
        }

        async function setQuantityOnInput(inputElem, value) {
            // Dùng native setter để kích hoạt React controlled input
            await driver.executeScript(`
                let input = arguments[0];
                input.scrollIntoView({ behavior: 'instant', block: 'center' });
                input.focus();
                let setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, arguments[1]);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new KeyboardEvent('keyup',  { bubbles: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                document.body.click();
            `, inputElem, String(value));

            // Đợi DOM phản hồi rồi kiểm tra giá trị đã được ghi nhận chưa
            await driver.sleep(800);
            let accepted = await inputElem.getAttribute('value');

            // Nếu giá trị chưa thay đổi, thử lại một lần nữa
            if (accepted !== String(value)) {
                await driver.executeScript(`
                    let input = arguments[0];
                    input.scrollIntoView({ behavior: 'instant', block: 'center' });
                    input.select();
                    let setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, arguments[1]);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                `, inputElem, String(value));
                await driver.sleep(800);
                accepted = await inputElem.getAttribute('value');
                console.log(`  [Retry] Input value sau lần 2: ${accepted}`);
            }

            return accepted;
        }

        async function getVisibleQuantityInput() {
            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            for (let input of inputs) {
                try { if (await input.isDisplayed()) return input; } catch (e) { }
            }
            return null;
        }

        async function addProductToCart(productUrl) {
            await driver.get(productUrl);
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
            await driver.sleep(2000);

            // Click vào sản phẩm đầu tiên trong danh sách
            const productXPath = "(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[1]";
            const productElement = await driver.wait(until.elementLocated(By.xpath(productXPath)), 15000);
            await driver.executeScript('arguments[0].click();', productElement);
            await driver.sleep(3000);
            await driver.executeScript('window.scrollTo(0, 800);');
            await driver.sleep(1000);

            // Tìm và click nút Mua ngay / Thêm vào giỏ (chỉ click phần tử đang hiển thị)
            const buyBtnXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')]";
            let clicked = false;
            try {
                await driver.wait(until.elementLocated(By.xpath(buyBtnXPath)), 10000);
                const btns = await driver.findElements(By.xpath(buyBtnXPath));
                for (let btn of btns) {
                    if (await btn.isDisplayed()) {
                        await driver.executeScript('arguments[0].click();', btn);
                        clicked = true;
                        break;
                    }
                }
            } catch (e) { }

            if (!clicked) {
                const addBtnXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')]";
                const addBtns = await driver.findElements(By.xpath(addBtnXPath));
                for (let btn of addBtns) {
                    if (await btn.isDisplayed()) { await driver.executeScript('arguments[0].click();', btn); break; }
                }
            }

            await driver.sleep(3000);

            // Quay về trang danh mục để thêm sản phẩm tiếp (không vào giỏ ngay)
            const currentUrl = await driver.getCurrentUrl();
            if (currentUrl.includes('gio-hang')) {
                // Nếu bị redirect vào giỏ hàng thì quay lại để tiếp tục thêm hàng
                await driver.navigate().back();
                await driver.sleep(1000);
            }
        }

        before(async function () {
            driver = await new Builder().forBrowser('chrome').build();
            await driver.manage().window().maximize();

            // Thêm lần lượt 3 sản phẩm khác nhau vào giỏ hàng
            for (const product of targetProducts) {
                console.log(`Đang thêm: ${product.name}`);
                await addProductToCart(product.url);
            }

            // Vào trang giỏ hàng để bắt đầu test
            await driver.get('https://fptshop.com.vn/gio-hang');
            await driver.wait(until.urlContains('gio-hang'), 10000);
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
            // Bước 1: Click "Đạ chọn tất cả" để chọn tất cả sản phẩm trong giỏ
            // FPTShop dùng dynamic ID có dạng "{random}-undefined" cho checkbox "Chọn tất cả"
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

            // Bước 2: Lấy tất cả input số lượng trong giỏ hàng (sau khi chọn tất cả)
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
                const priceBefore = await getPrice();
                const accepted = await setQuantityOnInput(visibleInputs[i], targetQty);
                await waitForPriceChange(priceBefore, 15000);

                console.log(`Sản phẩm ${i + 1}: đặt ${targetQty} -> UI ghi nhận ${accepted}`);
                if (accepted !== String(targetQty)) {
                    console.log(`  [WARN] Sản phẩm ${i + 1} không nhận đúng giá trị (có thể bị giới hạn tồn kho)`);
                }
            }

            // Xác nhận giá đã thay đổi
            const finalPrice = await getPrice();
            expect(finalPrice).to.not.equal('0đ', 'Giỏ hàng không hiển thị giá sau khi thay đổi số lượng');
        });

        it('2. Về trang chủ rồi quay lại giỏ hàng', async function () {
            // Về trang chủ
            await driver.get('https://fptshop.com.vn');
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
            await driver.sleep(2000);

            const homeUrl = await driver.getCurrentUrl();
            expect(homeUrl).to.include('fptshop.com.vn', 'Không điều hướng được về trang chủ');
            console.log(`Đã về trang chủ: ${homeUrl}`);

            // Quay lại giỏ hàng
            await driver.get('https://fptshop.com.vn/gio-hang');
            await driver.wait(until.urlContains('gio-hang'), 10000);
            await driver.sleep(2000);

            const cartUrl = await driver.getCurrentUrl();
            expect(cartUrl).to.include('gio-hang', 'Không điều hướng được vào giỏ hàng');
            console.log(`Đã quay lại giỏ hàng: ${cartUrl}`);
        });

        it(`3. Kiểm tra số lượng sản phẩm đã được lưu là ${targetQty.toLocaleString()}`, async function () {
            // Đợi trang giỏ hàng load đủ
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
                // Fail với thông tin chi tiết sản phẩm nào không được lưu
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
