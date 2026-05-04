const { Builder, By, until, Key } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');

const testProducts = [
    { name: 'Điện thoại', url: 'https://fptshop.com.vn/dien-thoai' },
    { name: 'Máy tính xách tay', url: 'https://fptshop.com.vn/may-tinh-xach-tay' },
    { name: 'Máy tính bảng', url: 'https://fptshop.com.vn/may-tinh-bang' },
    { name: 'Màn hình máy tính', url: 'https://fptshop.com.vn/man-hinh' },
    { name: 'Máy tính để bàn', url: 'https://fptshop.com.vn/may-tinh-de-ban' }
];

testProducts.forEach((product, index) => {
    describe(`TC017: Chỉnh số lượng sản phẩm trong giỏ hàng - Iteration ${index + 1} (${product.name})`, function () {
        this.timeout(150000); // Cài đặt timeout cho toàn bộ suite
        let driver;

        // --- Các XPaths dùng chung ---
        const quantityInputXPath = "//input[@min='1'] | //input[contains(@class, 'text-center') and @type='text']";
        const plusButtonXPath = "(" + quantityInputXPath + ")[1]/following-sibling::*[1]";
        const minusButtonXPath = "(" + quantityInputXPath + ")[1]/preceding-sibling::*[1]";
        const totalPriceXPath = "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cần thanh toán')]/following-sibling::* | //div[contains(@class, 'cart-summary')]//strong | //strong[contains(text(), 'đ') or contains(text(), '₫')] | //span[contains(text(), 'đ') and contains(@class, 'text-red')]";

        let initialPrice = '0đ';

        before(async function () {
            // Khởi tạo Chrome driver
            driver = await new Builder().forBrowser('chrome').build();
            await driver.manage().window().maximize();

            // Thêm sản phẩm vào giỏ hàng (tiền điều kiện chung)
            await addProductToCart(product.url);

            // Lấy giá ban đầu (đảm bảo trang đã load và giá khác 0đ)
            for (let i = 0; i < 10; i++) {
                initialPrice = await getPrice();
                if (initialPrice !== '0đ') break;
                await driver.sleep(1000);
            }
            console.log(`Giá trị đơn hàng ban đầu: ${initialPrice}`);
        });

        afterEach(async function () {
            // Chụp màn hình cho mỗi step (cho cả pass và fail để lấy bằng chứng)
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc017');
            addContext(this, {
                title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi',
                value: `../../${screenshotPath}`
            });
        });

        after(async function () {
            // Đóng trình duyệt sau khi tất cả các test hoàn thành
            if (driver) {
                await driver.quit();
            }
        });

        // --- Các hàm hỗ trợ ---

        async function addProductToCart(productUrl) {
            await driver.get(productUrl);
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
            await driver.sleep(2000);

            const productXPath = "(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[1]";
            const productElement = await driver.wait(
                until.elementLocated(By.xpath(productXPath)),
                15000,
                'Không tìm thấy sản phẩm'
            );
            await driver.executeScript('arguments[0].click();', productElement);
            await driver.sleep(3000);
            await driver.executeScript('window.scrollTo(0, 800);');
            await driver.sleep(1000);

            const actionButtonXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')]";
            let clicked = false;
            try {
                await driver.wait(until.elementLocated(By.xpath(actionButtonXPath)), 10000);
                const actionButtons = await driver.findElements(By.xpath(actionButtonXPath));
                for (let btn of actionButtons) {
                    if (await btn.isDisplayed()) {
                        await driver.executeScript('arguments[0].click();', btn);
                        clicked = true;
                        break;
                    }
                }
            } catch (e) { }

            if (!clicked) {
                try {
                    const addCartBtnXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')]";
                    const addCartBtns = await driver.findElements(By.xpath(addCartBtnXPath));
                    for (let btn of addCartBtns) {
                        if (await btn.isDisplayed()) {
                            await driver.executeScript('arguments[0].click();', btn);
                            break;
                        }
                    }
                } catch (e) { }
            }

            await driver.sleep(3000); // Đợi pop-up xử lý hoặc auto-redirect

            // Chỉ điều hướng nếu hệ thống không tự động sang trang giỏ hàng
            const currentUrl = await driver.getCurrentUrl();
            if (!currentUrl.includes('gio-hang')) {
                await driver.get('https://fptshop.com.vn/gio-hang');
                await driver.wait(until.urlContains('gio-hang'), 10000, 'Không thể truy cập giỏ hàng');
            }

            try {
                const emptyCart = await driver.findElements(By.xpath("//*[contains(text(), 'Chưa có sản phẩm nào')]"));
                if (emptyCart.length > 0) {
                    await driver.get(productUrl);
                    await driver.sleep(2000);
                    const btnMuaNhanhXPath = "//button[contains(text(), 'Mua ngay') or contains(text(), 'Cho vào giỏ')] | //a[contains(text(), 'Mua ngay') or contains(text(), 'Cho vào giỏ')]";
                    const btns = await driver.findElements(By.xpath(btnMuaNhanhXPath));
                    for (let btn of btns) {
                        if (await btn.isDisplayed()) {
                            await driver.executeScript('arguments[0].click();', btn);
                            break;
                        }
                    }
                    await driver.sleep(3000);
                    await driver.get('https://fptshop.com.vn/gio-hang');
                }
            } catch (e) { }
        }

        async function getPrice() {
            try {
                const priceElems = await driver.findElements(By.xpath(totalPriceXPath));
                if (priceElems.length > 0) {
                    for (let i = priceElems.length - 1; i >= 0; i--) {
                        let text = await priceElems[i].getText();
                        text = text.trim();
                        // Regex kiểm tra xem chuỗi có định dạng giá tiền (VD: 2.790.000₫ hoặc 2.790.000 đ)
                        if (/^[0-9.,\s]+[đ₫]$/i.test(text)) {
                            return text;
                        }
                    }
                }
                return '0đ';
            } catch (e) {
                return '0đ';
            }
        }

        async function getQuantity() {
            try {
                const inputs = await driver.findElements(By.xpath(quantityInputXPath));
                for (let input of inputs) {
                    if (await input.isDisplayed()) return await input.getAttribute('value');
                }
            } catch (e) { }
            return '1';
        }

        async function waitForPriceChange(oldPrice, timeout = 10000) {
            let currentPrice = oldPrice;
            try {
                await driver.wait(async () => {
                    currentPrice = await getPrice();
                    return currentPrice !== oldPrice;
                }, timeout);
                // Đợi thêm 1 chút để DOM ổn định sau khi text thay đổi
                await driver.sleep(500);
                currentPrice = await getPrice();
            } catch (e) {
                // Timeout: giá không thay đổi
            }
            return currentPrice;
        }

        async function testQuantityInput(valueToInput, priceBefore, timeoutMs = 15000) {
            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            let targetInput = inputs[0];
            for (let input of inputs) {
                try {
                    if (await input.isDisplayed()) {
                        targetInput = input;
                        break;
                    }
                } catch (e) { }
            }

            // Thực thi nhập liệu và submit hoàn toàn bằng JS
            await driver.executeScript(`
            let input = arguments[0];
            let valueToInput = arguments[1];
            
            // Cuộn tới phần tử sao cho nằm giữa màn hình để ảnh chụp không bị xấu
            input.scrollIntoView({ behavior: 'instant', block: 'center' });
            input.focus();
            
            let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, valueToInput);
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
            
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            document.body.click();
        `, targetInput, valueToInput);

            // Chờ hệ thống xử lý và cập nhật giá tiền
            const currentPrice = await waitForPriceChange(priceBefore, timeoutMs);
            const currentValue = await targetInput.getAttribute('value');

            console.log(`=> Đã nhập: ${valueToInput}`);
            console.log(`=> Hệ thống ghi nhận (Value trên UI): ${currentValue}`);
            console.log(`=> Giá trị thanh toán hiện tại: ${currentPrice}`);

            return { currentValue, currentPrice };
        }

        // --- CÁC TEST CASES ĐƯỢC CHIA NHỎ ---

        it('1. Thay đổi số lượng bằng dấu +', async function () {
            let plusBtn;
            try {
                plusBtn = await driver.findElement(By.xpath(plusButtonXPath));
            } catch (e) {
                console.log("Không tìm thấy nút cộng, bỏ qua step này.");
                this.skip();
            }

            const qtyBefore = await getQuantity();
            const priceBefore = await getPrice();

            await driver.executeScript('arguments[0].click();', plusBtn);
            const priceAfterPlus = await waitForPriceChange(priceBefore, 10000);
            const qtyAfter = await getQuantity();

            console.log(`Số lượng: ${qtyBefore} -> ${qtyAfter}`);
            console.log(`Giá trị: ${priceBefore} -> ${priceAfterPlus}`);

            expect(qtyBefore).to.not.equal(qtyAfter, 'Số lượng sản phẩm không tăng lên sau khi nhấn [+]');
            expect(priceBefore).to.not.equal(priceAfterPlus, 'Giá tiền không cập nhật sau khi nhấn [+]');
        });

        it('2. Thay đổi số lượng bằng dấu -', async function () {
            let minusBtn;
            try {
                minusBtn = await driver.findElement(By.xpath(minusButtonXPath));
            } catch (e) {
                console.log("Không tìm thấy nút trừ, bỏ qua step này.");
                this.skip();
            }

            const qtyBefore = await getQuantity();
            const priceBefore = await getPrice();

            if (parseInt(qtyBefore) <= 1) {
                console.log("Số lượng đang là 1, bỏ qua step trừ để tránh xoá sản phẩm khỏi giỏ.");
                this.skip();
            }

            await driver.executeScript('arguments[0].click();', minusBtn);
            const priceAfterMinus = await waitForPriceChange(priceBefore, 10000);
            const qtyAfter = await getQuantity();

            console.log(`Số lượng: ${qtyBefore} -> ${qtyAfter}`);
            console.log(`Giá trị: ${priceBefore} -> ${priceAfterMinus}`);

            expect(qtyBefore).to.not.equal(qtyAfter, 'Số lượng sản phẩm không giảm đi sau khi nhấn [-]');
            expect(priceBefore).to.not.equal(priceAfterMinus, 'Giá tiền không cập nhật sau khi nhấn [-]');
        });

        it('3. Thay đổi số lượng bằng nhập trực tiếp 30', async function () {
            const priceBefore = await getPrice();
            const { currentPrice } = await testQuantityInput('30', priceBefore);
            expect(priceBefore).to.not.equal(currentPrice, 'Giá tiền không cập nhật sau khi nhập 30');
        });

        it('4. Thay đổi số lượng bằng nhập trực tiếp 300000 ', async function () {
            const priceBefore = await getPrice();
            const { currentPrice } = await testQuantityInput('300000', priceBefore);

            if (currentPrice === priceBefore) {
                // Nếu giá không load/cập nhật -> Hệ thống ngầm từ chối (hết hàng), lúc này BẮT BUỘC phải có cảnh báo
                const hasAlert = await driver.executeScript(`
                const alerts = document.querySelectorAll('.toast, .alert, .notification, .message, .error');
                for(let a of alerts) {
                    let text = a.innerText.toLowerCase();
                    if(text.includes('tồn kho') || text.includes('hết hàng') || text.includes('không đủ') || text.includes('vượt quá')) {
                        return true;
                    }
                }
                return false;
            `);

                expect(hasAlert).to.equal(true, 'Hệ thống từ chối số lượng 40000 (giá không đổi) nhưng lại KHÔNG hiển thị cảnh báo hết hàng/tồn kho');
            } else {
                // Nếu giá vẫn load bình thường -> Vẫn còn hàng, cho phép vượt qua
                expect(priceBefore).to.not.equal(currentPrice);
            }
        });

        it('5. Thay đổi số lượng bằng nhập trực tiếp 99999999999999', async function () {
            const priceBefore = await getPrice();
            const { currentPrice } = await testQuantityInput('99999999999999', priceBefore, 2000);
            expect(priceBefore).to.not.equal(
                currentPrice,
                'Hệ thống không cập nhật giá trị hoặc xử lý sai khi nhập số lượng siêu lớn (99999999999999). Lỗi bảo mật/logic hệ thống.'
            );
        });
    });
});
