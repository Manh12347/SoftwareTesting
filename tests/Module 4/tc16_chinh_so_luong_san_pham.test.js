const { Builder, By, until, Key } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');

const testProducts = [
    { name: 'Điện thoại', url: 'https://fptshop.com.vn/dien-thoai' },
    { name: 'Máy tính xách tay', url: 'https://fptshop.com.vn/may-tinh-xach-tay' },
    { name: 'Máy tính bảng', url: 'https://fptshop.com.vn/may-tinh-bang' },
    { name: 'Màn hình máy tính', url: 'https://fptshop.com.vn/man-hinh' },
    { name: 'Máy tính để bàn', url: 'https://fptshop.com.vn/may-tinh-de-ban' }
];

testProducts.forEach((product, index) => {
    describe(`TC016: Chỉnh số lượng sản phẩm trong giỏ hàng - Iteration ${index + 1} (${product.name})`, function () {
        this.timeout(150000); // Cài đặt timeout cho toàn bộ suite
        let driver;
        
        // Import helpers from cartHelper
        const { getPrice, getQuantity, waitForPriceChange, addProductToCart, testQuantityInput, quantityInputXPath, totalPriceXPath } = require('../../function/module4/cartHelper');

        const plusButtonXPath = "(" + quantityInputXPath + ")[1]/following-sibling::*[1]";
        const minusButtonXPath = "(" + quantityInputXPath + ")[1]/preceding-sibling::*[1]";

        let initialPrice = '0đ';

        before(async function () {
            driver = await new Builder().forBrowser('chrome').build();
            await driver.manage().window().maximize();
            await closeBanner(driver);
            await closeCookieBanner(driver);
            await addProductToCart(driver, product.url);

            for (let i = 0; i < 10; i++) {
                initialPrice = await getPrice(driver);
                if (initialPrice !== '0đ') break;
                await driver.sleep(1000);
            }
            console.log(`Giá trị đơn hàng ban đầu: ${initialPrice}`);
        });

        afterEach(async function () {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc016');
            addContext(this, {
                title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi',
                value: `../../${screenshotPath}`
            });
        });

        after(async function () {
            if (driver) {
                await driver.quit();
            }
        });

        // --- CÁC TEST CASES ĐƯỢC CHIA NHỎ ---

        it('1. Thay đổi số lượng bằng dấu +', async function () {
            let plusBtn;
            try {
                plusBtn = await driver.findElement(By.xpath(plusButtonXPath));
            } catch (e) {
                console.log("Không tìm thấy nút cộng, bỏ qua step này.");
                this.skip();
            }

            const qtyBefore = await getQuantity(driver);
            const priceBefore = await getPrice(driver);

            await driver.executeScript('arguments[0].click();', plusBtn);
            const priceAfterPlus = await waitForPriceChange(driver, priceBefore, 10000);
            const qtyAfter = await getQuantity(driver);

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

            const qtyBefore = await getQuantity(driver);
            const priceBefore = await getPrice(driver);

            if (parseInt(qtyBefore) <= 1) {
                console.log("Số lượng đang là 1, bỏ qua step trừ để tránh xoá sản phẩm khỏi giỏ.");
                this.skip();
            }

            await driver.executeScript('arguments[0].click();', minusBtn);
            const priceAfterMinus = await waitForPriceChange(driver, priceBefore, 10000);
            const qtyAfter = await getQuantity(driver);

            console.log(`Số lượng: ${qtyBefore} -> ${qtyAfter}`);
            console.log(`Giá trị: ${priceBefore} -> ${priceAfterMinus}`);

            expect(qtyBefore).to.not.equal(qtyAfter, 'Số lượng sản phẩm không giảm đi sau khi nhấn [-]');
            expect(priceBefore).to.not.equal(priceAfterMinus, 'Giá tiền không cập nhật sau khi nhấn [-]');
        });

        it('3. Thay đổi số lượng bằng nhập trực tiếp 30', async function () {
            const priceBefore = await getPrice(driver);
            const { currentPrice } = await testQuantityInput(driver, '30', priceBefore);
            expect(priceBefore).to.not.equal(currentPrice, 'Giá tiền không cập nhật sau khi nhập 30');
        });

        it('4. Thay đổi số lượng bằng nhập trực tiếp 300000 ', async function () {
            const priceBefore = await getPrice(driver);
            const { currentPrice } = await testQuantityInput(driver, '300000', priceBefore);

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
            const priceBefore = await getPrice(driver);
            const { currentPrice } = await testQuantityInput(driver, '99999999999999', priceBefore, 2000);
            expect(priceBefore).to.not.equal(
                currentPrice,
                'Hệ thống không cập nhật giá trị hoặc xử lý sai khi nhập số lượng siêu lớn (99999999999999). Lỗi bảo mật/logic hệ thống.'
            );
        });
    });
});
