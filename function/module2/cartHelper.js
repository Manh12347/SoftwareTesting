const { By, until } = require('selenium-webdriver');

/**
 * Chuyển đổi chuỗi giá tiền sang số.
 * @param {string} priceString - Chuỗi giá (VD: "17.490.000đ")
 * @returns {number} - Số tiền (VD: 17490000)
 */
function parsePrice(priceString) {
    const cleaned = priceString.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10);
}

/**
 * Lấy giá sản phẩm từ trang detail.
 * @param {import('selenium-webdriver').WebDriver} driver
 * @returns {Promise<{price: number, priceText: string}|null>}
 */
async function getProductPrice(driver) {
    await driver.executeScript('window.scrollTo(0, 0);');
    await driver.wait(until.elementLocated(By.xpath("//span[contains(text(),'đ')]")), 3000);

    // XPath nâng cao: tìm span chứa ký hiệu đ
    const priceXPath = "//span[contains(text(),'đ')]";

    try {
        const elements = await driver.findElements(By.xpath(priceXPath));
        for (const el of elements) {
            const text = await el.getText();
            if (text && text.includes('đ')) {
                const price = parsePrice(text);
                if (price > 1000 && price < 100000000) {
                    console.log(`Tim thay gia san pham: ${text} => ${price.toLocaleString()}đ`);
                    return {
                        price: price,
                        priceText: text.trim()
                    };
                }
            }
        }
    } catch (e) {
        console.log('Lỗi khi lấy giá:', e.message);
    }
    return null;
}



module.exports = { parsePrice, getProductPrice };
