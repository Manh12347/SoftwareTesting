const { By, until } = require('selenium-webdriver');

// User-provided stable XPaths
const QR_CODE_XPATH = "/html/body/main/section/div/div[2]/div[1]/div[6]/div[3]/button/div[2]/span";
const DAT_HANG_XPATH = "/html/body/main/section/div/div[2]/div[2]/div/div/button";

async function waitForBody(driver, timeoutMs = 15000) {
    await driver.wait(until.elementLocated(By.tagName('body')), timeoutMs);
}

async function findFirstVisible(driver, xpath) {
    const elements = await driver.findElements(By.xpath(xpath));
    for (const element of elements) {
        try {
            if (await element.isDisplayed()) return element;
        } catch (e) {
            // ignore
        }
    }
    return null;
}

async function clickVisible(driver, expect, xpath, timeoutMs = 10000, label = '') {
    await driver.wait(until.elementLocated(By.xpath(xpath)), timeoutMs);
    const element = await findFirstVisible(driver, xpath);
    expect(element, `Không tìm thấy phần tử để click${label ? `: ${label}` : ''}`).to.not.equal(null);

    try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', element);
    } catch (e) { }

    try {
        await element.click();
    } catch (e1) {
        try {
            await driver.actions({ async: true }).move({ origin: element }).click().perform();
        } catch (e2) {
            await driver.executeScript('arguments[0].click();', element);
        }
    }
    return element;
}

async function setInputIfPresent(driver, xpath, value) {
    const element = await findFirstVisible(driver, xpath);
    if (!element) return false;
    try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', element);
    } catch (e) { }
    try {
        await driver.executeScript('arguments[0].focus();', element);
    } catch (e) { }
    try {
        await element.clear();
    } catch (e) { }
    try {
        await element.sendKeys(String(value));
    } catch (e) {
    }

    try {
        await driver.executeScript(`
            const input = arguments[0];
            const val = arguments[1];
            input.focus();
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, val);
            else input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
        `, element, String(value));
    } catch (e) { }

    try {
        const currentVal = String(await element.getAttribute('value') || '').trim();
        if (String(value).trim() && currentVal.length === 0) {
            try { await driver.executeScript('arguments[0].click();', element); } catch (e) { }
            try {
                await driver.executeScript(`
                    const input = arguments[0];
                    const val = arguments[1];
                    input.focus();
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    if (setter) setter.call(input, val);
                    else input.value = val;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.blur();
                `, element, String(value));
            } catch (e2) { }
        }
    } catch (e) { }
    return true;
}

async function setInputRequired(driver, expect, xpath, value, label, minLen = 1) {
    const el = await findFirstVisible(driver, xpath);
    expect(el, `Không tìm thấy input bắt buộc: ${label}`).to.not.equal(null);

    await setInputIfPresent(driver, xpath, value);
    await driver.sleep(200);

    const actual = String(await el.getAttribute('value') || '').trim();
    expect(
        actual.length,
        `${label} đang bị trống sau khi nhập (có thể selector trỏ nhầm vào ô search)`
    ).to.be.at.least(minLen);
    return true;
}

function randomDigits(count) {
    let out = '';
    for (let i = 0; i < count; i++) out += Math.floor(Math.random() * 10);
    return out;
}

async function openDropdownAndPickRandom(driver, openXpath, timeoutMs = 7000, label = '') {
    const openEl = await findFirstVisible(driver, openXpath);
    if (!openEl) return false;
    await clickVisible(driver, { to: { not: { equal: () => {} } } }, openXpath, timeoutMs, label); 
    await driver.sleep(500);

    const optionXPaths = [
        "//li[contains(@class,'select-item')]",
        "//*[@role='option']",
        "//div[contains(@class,'select-item')]",
        "//div[contains(@class,'item')]",
    ];

    const candidates = [];
    for (const xp of optionXPaths) {
        const found = await driver.findElements(By.xpath(xp));
        for (const el of found) {
            try {
                if (!(await el.isDisplayed())) continue;
                const text = (await el.getText()).trim();
                if (!text) continue;
                if (/^chọn\b/i.test(text)) continue;
                candidates.push({ el, text });
            } catch (e) {
            }
        }
        if (candidates.length > 0) break;
    }

    if (candidates.length === 0) return false;

    const idx = Math.floor(Math.random() * candidates.length);
    const picked = candidates[idx];
    try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', picked.el);
    } catch (e) { }

    try {
        await driver.executeScript('arguments[0].click();', picked.el);
    } catch (e) {
        await picked.el.click();
    }

    await driver.sleep(800);
    console.log(`Đã chọn ngẫu nhiên: ${picked.text}`);
    return true;
}

async function waitForAnyLocated(driver, xpaths, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        for (const xp of xpaths) {
            const el = await findFirstVisible(driver, xp);
            if (el) return { xpath: xp, element: el };
        }
        await driver.sleep(300);
    }
    return null;
}

async function getPaymentRowByText(driver, labelText) {
    const labelEl = await findFirstVisible(driver, `//*[normalize-space(.)='${labelText}']`);
    if (!labelEl) return null;

    const clickable = await driver.executeScript(
        `
        const start = arguments[0];
        const isSelectable = (el) => {
          if (!el || !el.getAttribute) return false;
          const role = el.getAttribute('role');
          if (role === 'radio' || role === 'button') return true;
          const tag = (el.tagName || '').toUpperCase();
          if (tag === 'LABEL' || tag === 'BUTTON') return true;
          if (el.querySelector && el.querySelector('input[type="radio"]')) return true;
          const tabIndex = el.getAttribute('tabindex');
          if (tabIndex !== null && tabIndex !== undefined) return true;
          try {
            const cursor = window.getComputedStyle(el).cursor;
            if (cursor === 'pointer') return true;
          } catch (e) {}
          return false;
        };
        let cur = start;
        for (let i = 0; i < 10 && cur; i++) {
          if (isSelectable(cur)) return cur;
          cur = cur.parentElement;
        }
        return start;
        `,
        labelEl
    );

    return { el: clickable, labelEl };
}

async function isPaymentRowSelected(driver, row) {
    if (!row) return false;
    try {
        return await driver.executeScript(
            `
            const el = arguments[0];
            const aria = el.getAttribute && el.getAttribute('aria-checked');
            if (aria !== null && aria !== undefined) return String(aria).toLowerCase() === 'true';
            const radio = el.querySelector && el.querySelector('input[type="radio"]');
            if (radio) return !!radio.checked;
            const checkedRadio = el.querySelector && el.querySelector('input[type="radio"]:checked');
            if (checkedRadio) return true;
            const dataState = el.getAttribute && el.getAttribute('data-state');
            if (dataState) return String(dataState).toLowerCase() === 'checked';
            const cls = (el.className || '').toString();
            return /\b(active|selected|checked)\b/i.test(cls);
            `,
            row.el
        );
    } catch (e) {
        return false;
    }
}

async function clickPaymentByText(driver, labelText) {
    const row = await getPaymentRowByText(driver, labelText);
    if (!row) return null;
    try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', row.el); } catch (e) { }
    try {
        await row.el.click();
    } catch (e1) {
        try {
            await driver.actions({ async: true }).move({ origin: row.el }).click().perform();
        } catch (e2) {
            try { await driver.executeScript('arguments[0].click();', row.el); } catch (e3) { }
        }
    }
    await driver.sleep(350);
    return row;
}

async function isRadioChecked(driver, radioEl) {
    try {
        return await driver.executeScript('return !!arguments[0].checked;', radioEl);
    } catch (e) {
        try {
            return await radioEl.isSelected();
        } catch (e2) {
            const checked = await radioEl.getAttribute('checked');
            return checked === 'true' || checked === 'checked';
        }
    }
}

async function selectQRPayment(driver, timeoutMs = 15000) {
    const labelText = 'Chuyển khoản ngân hàng (QR Code)';
    const codLabelText = 'Thanh toán khi nhận hàng';
    await driver.wait(until.elementLocated(By.xpath(`//*[normalize-space(.)='${labelText}']`)), timeoutMs);

    try {
        const qrExact = await findFirstVisible(driver, `${QR_CODE_XPATH}/ancestor::button[1] | ${QR_CODE_XPATH}`);
        if (qrExact) {
            try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', qrExact); } catch (e) { }
            try { await qrExact.click(); } catch (e1) {
                try { await driver.actions({ async: true }).move({ origin: qrExact }).click().perform(); } catch (e2) {
                    try { await driver.executeScript('arguments[0].click();', qrExact); } catch (e3) { }
                }
            }
            await driver.sleep(500);
        }
    } catch (e) {
    }

    for (let i = 0; i < 5; i++) {
        const qrRow = await clickPaymentByText(driver, labelText);
        try {
            const labelEl = qrRow ? qrRow.labelEl : await findFirstVisible(driver, `//*[normalize-space(.)='${labelText}']`);
            if (labelEl) {
                try { await labelEl.click(); } catch (e) {
                    try { await driver.actions({ async: true }).move({ origin: labelEl }).click().perform(); } catch (e2) { }
                }
                await driver.sleep(250);
            }
        } catch (e) { }

        const qrChecked = await isPaymentRowSelected(driver, qrRow);
        const codRow = await getPaymentRowByText(driver, codLabelText);
        const codChecked = await isPaymentRowSelected(driver, codRow);
        console.log(`[PAY] attempt ${i + 1}: qrChecked=${qrChecked} codChecked=${codChecked}`);
        if (qrChecked && !codChecked) {
            await driver.sleep(1200);
            const qrStill = await isPaymentRowSelected(driver, await getPaymentRowByText(driver, labelText));
            const codStill = await isPaymentRowSelected(driver, await getPaymentRowByText(driver, codLabelText));
            if (qrStill && !codStill) return true;
        }

        await driver.sleep(700);
    }

    console.log('[WARN] QR Code bị tự chuyển lại "Thanh toán khi nhận hàng". Vẫn tiếp tục bấm "Đặt hàng" để quan sát luồng.');
    return false;
}

async function waitForGatewaySignal(driver, timeoutMs = 45000) {
    const start = Date.now();
    const gatewayMarkers = [
        "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
        "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]",
        "//*[contains(normalize-space(.), 'Quét hoặc tải mã QR') or contains(normalize-space(.), 'mã QR để thanh toán')]",
        "//form[contains(@action,'vnpay') or contains(@action,'pay') or contains(@action,'payment')]",
        "//img[contains(@alt,'VNPAY') or contains(@src,'vnpay')]",
        "//iframe[contains(@src,'vnpay') or contains(@src,'pay') or contains(@src,'payment')]",
    ];

    while (Date.now() - start < timeoutMs) {
        const url = await driver.getCurrentUrl();
        if ((url.includes('vnpay') || url.includes('pay') || url.includes('payment') || url.includes('qr')) && !url.includes('gio-hang')) return true;

        for (const xp of gatewayMarkers) {
            const el = await findFirstVisible(driver, xp);
            if (el) return true;
        }
        await driver.sleep(500);
    }
    return false;
}

async function waitForGatewayAfterPlaceOrder(driver, originalUrl, timeoutMs = 90000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const handles = await driver.getAllWindowHandles();
        if (handles.length > 1) return { kind: 'new-window' };

        const url = await driver.getCurrentUrl();
        if (url && url.includes('giao-dich-dang-xu-ly')) {
            await driver.sleep(800);
            continue;
        }

        if (url && !url.includes('gio-hang')) {
            const marker = await waitForGatewaySignal(driver, 1200);
            if (marker) return { kind: 'gateway', url };
        }

        const stillOnCart = url.includes('gio-hang');
        if (!stillOnCart) {
        } else {
            const strictMarkers = [
                "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
                "//form[contains(@action,'vnpay') or contains(@action,'pay') or contains(@action,'payment')]",
                "//iframe[contains(@src,'vnpay') or contains(@src,'pay') or contains(@src,'payment')]",
            ];
            for (const xp of strictMarkers) {
                const el = await findFirstVisible(driver, xp);
                if (el) return { kind: 'marker', url };
            }
        }

        await driver.sleep(1000);
    }
    return null;
}

async function acceptTermsIfPresent(driver) {
    const termsCandidateXPath = [
        "//label[contains(., 'điều khoản') or contains(., 'Điều khoản') or contains(., 'chính sách') or contains(., 'Chính sách') or contains(., 'Tôi đồng ý') or contains(., 'tôi đồng ý')]",
        "//span[contains(., 'điều khoản') or contains(., 'Điều khoản') or contains(., 'chính sách') or contains(., 'Chính sách') or contains(., 'Tôi đồng ý') or contains(., 'tôi đồng ý')]",
    ].join(' | ');

    const label = await findFirstVisible(driver, termsCandidateXPath);
    if (!label) return false;

    const checkbox = await findFirstVisible(driver, "//input[@type='checkbox'][ancestor::label[contains(., 'điều khoản') or contains(., 'chính sách') or contains(., 'đồng ý')]] | //input[@type='checkbox'][preceding::*[contains(., 'điều khoản') or contains(., 'chính sách') or contains(., 'đồng ý')]][1]");
    if (checkbox) {
        let checked = false;
        try { checked = await checkbox.isSelected(); } catch (e) { }
        if (!checked) {
            try { await driver.executeScript('arguments[0].click();', checkbox); } catch (e) {
                try { await driver.executeScript('arguments[0].click();', label); } catch (e2) { }
            }
            await driver.sleep(400);
            return true;
        }
        return false;
    }

    try { await driver.executeScript('arguments[0].click();', label); } catch (e) { }
    await driver.sleep(400);
    return true;
}

async function pickRandomStoreFromAddressForm(driver, expect, timeoutMs = 20000) {
    const chooseStoreBtnXPath = [
        "//*[@id='address-form']/div[2]/div//button",
        "//*[@id='address-form']//button[contains(., 'Chọn') and (contains(., 'shop') or contains(., 'Shop') or contains(., 'cửa hàng') or contains(., 'Cửa hàng'))]",
        "//*[contains(normalize-space(.), 'Chọn shop có hàng gần nhất')]/ancestor::button[1]",
        "//*[contains(normalize-space(.), 'Chọn shop có hàng gần nhất')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
        "//*[contains(normalize-space(.), 'Chọn shop') and contains(normalize-space(.), 'gần nhất')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
        "//input[contains(@placeholder,'Chọn shop') or contains(@placeholder,'shop') or contains(@placeholder,'cửa hàng')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
    ].join(' | ');

    await clickVisible(driver, expect, chooseStoreBtnXPath, timeoutMs, 'Mở chọn shop');
    await driver.sleep(700);

    const storeCardXPaths = [
        "/html/body/div[12]/div[2]/div[2]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
        "/html/body/div[12]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
        "//div[contains(@class,'fixed') and contains(@class,'z-')]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
        "//div[contains(@class,'fixed') and contains(@class,'z-')]//div[contains(@class,'cursor-pointer') and contains(@class,'bg-white')]",
    ];

    const ready = await waitForAnyLocated(driver, storeCardXPaths, 15000);
    if (!ready) return false;

    const found = await driver.findElements(By.xpath(ready.xpath));
    const candidates = [];
    for (const el of found) {
        try {
            if (!(await el.isDisplayed())) continue;
            const text = (await el.getText()).replace(/\s+/g, ' ').trim();
            if (!text) continue;
            if (/chọn\s+shop\s+có\s+hàng\s+gần\s+nhất/i.test(text)) continue;
            candidates.push({ el, text });
        } catch (e) {
        }
    }

    if (candidates.length === 0) return false;

    const idx = Math.floor(Math.random() * candidates.length);
    const picked = candidates[idx];
    try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', picked.el);
    } catch (e) { }

    try {
        await driver.executeScript('arguments[0].click();', picked.el);
    } catch (e) {
        await picked.el.click();
    }

    await driver.sleep(800);

    const confirmStoreXPath = [
        "/html/body/div[12]/div[2]/div[2]/div/div[2]/button",
        "//div[contains(@class,'fixed') and contains(@class,'z-')]//button[contains(., 'Xác nhận') or contains(., 'Chọn') or contains(., 'Hoàn tất') or contains(., 'Đồng ý')]",
    ].join(' | ');
    const confirmBtn = await findFirstVisible(driver, confirmStoreXPath);
    if (confirmBtn) {
        try {
            await driver.executeScript('arguments[0].click();', confirmBtn);
        } catch (e) {
            try { await confirmBtn.click(); } catch (e2) { }
        }
        await driver.sleep(1200);
    } else {
        await driver.sleep(800);
    }

    console.log(`Đã chọn cửa hàng ngẫu nhiên: ${picked.text}`);
    return true;
}

async function tryCancelOnGateway(driver) {
    await waitForAnyLocated(driver, [
        "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]",
        "//*[contains(normalize-space(.), 'Quét hoặc tải mã QR') or contains(normalize-space(.), 'mã QR để thanh toán')]",
        "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
    ], 15000);

    const cancelSmartXPath = [
        "/html/body/div[6]/div[1]/div[3]/div/button[2]",
        "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]/ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or contains(@class,'cursor-pointer')][1]",
        "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
    ].join(' | ');

    const smart = await findFirstVisible(driver, cancelSmartXPath);
    if (smart) {
        try {
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', smart);
        } catch (e) { }
        try {
            await smart.click();
        } catch (e1) {
            try {
                await driver.actions({ async: true }).move({ origin: smart }).click().perform();
            } catch (e2) {
                try { await driver.executeScript('arguments[0].click();', smart); } catch (e3) { }
            }
        }
        await driver.sleep(1200);
        return true;
    }

    const cancelXPath = [
        "/html/body/div[6]/div[1]/div[3]/div/button[2]",
        "//*[@id='btnCancel']",
        "//*[@id='cancel']",
        "//*[@name='cancel']",
        "//button[contains(., 'Hủy') or contains(., 'Huỷ')]",
        "//a[contains(., 'Hủy') or contains(., 'Huỷ')]",
        "//button[contains(., 'Quay lại') or contains(., 'Trở về') or contains(., 'Back') or contains(., 'Return')]",
        "//a[contains(., 'Quay lại') or contains(., 'Trở về') or contains(., 'Back') or contains(., 'Return')]",
        "//a[contains(@href, 'cancel') or contains(@href, 'return') or contains(@href, 'back')]",
    ].join(' | ');

    const direct = await findFirstVisible(driver, cancelXPath);
    if (direct) {
        await clickVisible(driver, { to: { not: { equal: () => {} } } }, cancelXPath, 7000, 'Nút hủy giao dịch (main doc)');
        return true;
    }

    const iframes = await driver.findElements(By.css('iframe'));
    for (const frame of iframes) {
        try {
            await driver.switchTo().frame(frame);
            const inFrame = await findFirstVisible(driver, cancelXPath);
            if (inFrame) {
                try {
                    await driver.executeScript('arguments[0].click();', inFrame);
                } catch (e) {
                    await inFrame.click();
                }
                await driver.switchTo().defaultContent();
                return true;
            }
            await driver.switchTo().defaultContent();
        } catch (e) {
            try { await driver.switchTo().defaultContent(); } catch (e2) { }
        }
    }

    return false;
}

async function assertPaymentFailedOrUnpaid(driver, expect) {
    const orderDetailLinkXPath = "//a[contains(., 'Chi tiết đơn hàng')] | //a[contains(@href,'chi-tiet') or contains(@href,'don-hang') or contains(@href,'order')]";
    const detailLink = await findFirstVisible(driver, orderDetailLinkXPath);
    if (detailLink) {
        try {
            await driver.executeScript('arguments[0].click();', detailLink);
            await driver.sleep(2000);
        } catch (e) { }
    }

    const processingStatusXPath = "//*[contains(., 'Đang xử lý') or contains(., 'đang xử lý') or contains(., 'Processing')]";
    const paymentFailedXPath = "//*[contains(., 'thất bại') or contains(., 'Thất bại') or contains(., 'chưa thanh toán') or contains(., 'Chưa thanh toán') or contains(., 'không thành công') or contains(., 'Không thành công') or contains(., 'Giao dịch thất bại') or contains(., 'giao dịch thất bại')]";

    const processing = await driver.findElements(By.xpath(processingStatusXPath));
    if (processing.length > 0) {
        console.log('Phát hiện trạng thái đơn hàng: Đang xử lý');
    } else {
        console.log('[INFO] Không thấy text "Đang xử lý" (có thể site hiển thị khác tùy thời điểm).');
    }

    const payStatus = await driver.findElements(By.xpath(paymentFailedXPath));
    expect(payStatus.length).to.be.at.least(1, 'Không tìm thấy trạng thái thanh toán thất bại/chưa thanh toán sau khi hủy giao dịch');
    console.log('Xác nhận: Trạng thái thanh toán là Thất bại hoặc Chưa thanh toán.');
}

module.exports = {
    QR_CODE_XPATH,
    DAT_HANG_XPATH,
    waitForBody,
    findFirstVisible,
    clickVisible,
    setInputIfPresent,
    setInputRequired,
    randomDigits,
    openDropdownAndPickRandom,
    waitForAnyLocated,
    getPaymentRowByText,
    isPaymentRowSelected,
    clickPaymentByText,
    isRadioChecked,
    selectQRPayment,
    waitForGatewaySignal,
    waitForGatewayAfterPlaceOrder,
    acceptTermsIfPresent,
    pickRandomStoreFromAddressForm,
    tryCancelOnGateway,
    assertPaymentFailedOrUnpaid
};
