const { By, until } = require('selenium-webdriver');

// XPaths
const quantityInputXPath = "//input[@min='1'] | //input[contains(@class, 'text-center') and @type='text']";
const totalPriceXPath = "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cần thanh toán')]/following-sibling::* | //div[contains(@class, 'cart-summary')]//strong | //strong[contains(text(), 'đ') or contains(text(), '₫')] | //span[contains(text(), 'đ') and contains(@class, 'text-red')]";

async function getPrice(driver) {
    try {
        const priceElems = await driver.findElements(By.xpath(totalPriceXPath));
        if (priceElems.length > 0) {
            for (let i = priceElems.length - 1; i >= 0; i--) {
                let text = await priceElems[i].getText();
                text = text.trim();
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

async function getQuantity(driver) {
    try {
        const inputs = await driver.findElements(By.xpath(quantityInputXPath));
        for (let input of inputs) {
            if (await input.isDisplayed()) return await input.getAttribute('value');
        }
    } catch (e) { }
    return '1';
}

async function waitForPriceChange(driver, oldPrice, timeout = 10000) {
    let currentPrice = oldPrice;
    try {
        await driver.wait(async () => {
            currentPrice = await getPrice(driver);
            return currentPrice !== oldPrice;
        }, timeout);
        await driver.sleep(500);
        currentPrice = await getPrice(driver);
    } catch (e) {
    }
    return currentPrice;
}

async function addProductToCart(driver, productUrl) {
    await driver.get(productUrl);
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);
    await driver.sleep(2000);

    const productXPath = "(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[1]";
    const productElement = await driver.wait(until.elementLocated(By.xpath(productXPath)), 15000, 'Không tìm thấy sản phẩm');
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

    await driver.sleep(3000);

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

async function setQuantityOnInput(driver, inputElem, value) {
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

    await driver.sleep(800);
    let accepted = await inputElem.getAttribute('value');

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
    }
    return accepted;
}

async function testQuantityInput(driver, valueToInput, priceBefore, timeoutMs = 15000) {
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
    
    await setQuantityOnInput(driver, targetInput, valueToInput);
    const currentPrice = await waitForPriceChange(driver, priceBefore, timeoutMs);
    const currentValue = await targetInput.getAttribute('value');

    return { currentValue, currentPrice };
}

module.exports = {
    getPrice,
    getQuantity,
    waitForPriceChange,
    addProductToCart,
    setQuantityOnInput,
    testQuantityInput,
    quantityInputXPath,
    totalPriceXPath
};
