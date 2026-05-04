const { By, until } = require('selenium-webdriver');
const data = require('../../data/data.json');

/**
 * Thực hiện tìm kiếm sản phẩm trên trang web.
 * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance.
 * @param {string|null} keyword - Từ khóa tìm kiếm.
 * @returns {Promise<{found: boolean, message: string|null, hasProducts: boolean, productTexts: string[], validationMessage: string|null}>}
 */
async function search(driver, keyword) {
    // XPath nâng cao: tìm input và button tìm kiếm
    const searchInputXPath = "//input[contains(@placeholder,'Nhập')]";
    const searchButtonXPath = "//button[contains(@title,'Tìm')]";

    const searchInput = await driver.wait(
        until.elementLocated(By.xpath(searchInputXPath)),
        15000,
        'Không tìm thấy ô tìm kiếm.'
    );

    // TC3: Click vào ô tìm kiếm trước khi bấm nút tìm kiếm
    if (keyword === null) {
        await searchInput.click();
    } else if (keyword) {
        await searchInput.sendKeys(keyword);
    }

    const searchButton = await driver.wait(
        until.elementLocated(By.xpath(searchButtonXPath)),
        15000,
        'Không tìm thấy nút tìm kiếm.'
    );
    await searchButton.click();

    // Xử lý theo từng trường hợp
    if (keyword === null) {
        // TC3: Từ khóa rỗng - kiểm tra thông báo validation
        await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'nhập')]")), 2000)
            .catch(() => {});

        let validationMessage = null;

        // Thử tìm thông báo validation
        // XPath nâng cao: tìm thông báo validation
        const validationXPaths = [
            "//span[contains(@class,'l6')]",
            "//span[contains(@class,'error')]",
            "//div[contains(@class,'message')]",
            "//p[contains(@class,'text')]"
        ];

        for (const xpath of validationXPaths) {
            try {
                const elements = await driver.findElements(By.xpath(xpath));
                for (const el of elements) {
                    const text = await el.getText();
                    if (text && text.trim() && text.length > 5) {
                        validationMessage = text.trim();
                        break;
                    }
                }
                if (validationMessage) break;
            } catch (e) {
                // Tiếp tục thử XPath khác
            }
        }

        // Kiểm tra xem input có focus không
        const isFocused = await driver.executeScript(
            "return document.activeElement.getAttribute('placeholder') === 'Nhập tên điện thoại, laptop, phụ kiện... cần tìm'"
        );

        return { found: false, message: null, hasProducts: false, productTexts: [], validationMessage, isFocused };
    }

    // Đợi sản phẩm hoặc thông báo xuất hiện
    await driver.sleep(2000);

    // Kiểm tra có thông báo không tìm thấy
    // XPath nâng cao: tìm thông báo không tìm thấy
    const noResultXPath = "//span[contains(@class,'l6')]";
    let message = null;
    let hasProducts = false;
    let found = false;
    let productTexts = [];

    try {
        const noResultElements = await driver.findElements(By.xpath(noResultXPath));
        if (noResultElements.length > 0) {
            message = await noResultElements[0].getText();
            hasProducts = false;
            found = false;
            return { found, message, hasProducts, productTexts, validationMessage: null };
        }
    } catch (e) {
        // Tiếp tục kiểm tra sản phẩm
    }

    // XPath nâng cao: tìm sản phẩm
    const productXPath = "//h3[contains(@class,'line-clamp')]";
    
    try {
        await driver.wait(until.elementLocated(By.xpath(productXPath)), 3000);
        
        // Scroll xuống để render tất cả sản phẩm
        let prevCount = 0;
        let currentCount = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;
        
        while (scrollAttempts < maxScrollAttempts) {
            const currentElements = await driver.findElements(By.xpath(productXPath));
            currentCount = currentElements.length;
            
            // Nếu số lượng sản phẩm không thay đổi, dừng scroll
            if (currentCount === prevCount && scrollAttempts > 0) {
                break;
            }
            
            prevCount = currentCount;
            
            // Scroll đến sản phẩm cuối cùng
            if (currentElements.length > 0) {
                await driver.executeScript("arguments[0].scrollIntoView({ block: 'end' });", currentElements[currentElements.length - 1]);
                await driver.sleep(500);
            }
            
            scrollAttempts++;
        }
        
        // Lấy text của tất cả sản phẩm
        const productElements = await driver.findElements(By.xpath(productXPath));
        for (const el of productElements) {
            try {
                const text = await el.getText();
                productTexts.push(text);
                
                // Kiểm tra sản phẩm có chứa từ khóa không
                if (keyword && text.toLowerCase().includes(keyword.toLowerCase())) {
                    found = true;
                }
            } catch (e) {
                // Element có thể đã bị xóa, bỏ qua
            }
        }
        
        hasProducts = productTexts.length > 0;
    } catch (e) {
        hasProducts = false;
        found = false;
    }

    return { found, message, hasProducts, productTexts, validationMessage: null };
}

module.exports = { search };
