const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { takeScreenshot } = require('../../function/screenshotHelper');

describe('TC020: Đặt hàng, hủy giao dịch Chuyển khoản ngân hàng (QR code)', function () {
    this.timeout(300000);
    let driver;

    // User-provided stable XPaths (as of current checkout UI)
    const QR_CODE_XPATH = "/html/body/main/section/div/div[2]/div[1]/div[6]/div[3]/button/div[2]/span";
    const DAT_HANG_XPATH = "/html/body/main/section/div/div[2]/div[2]/div/div/button";

    // --- Helpers ---

    async function waitForBody(timeoutMs = 15000) {
        await driver.wait(until.elementLocated(By.tagName('body')), timeoutMs);
    }

    async function findFirstVisible(xpath) {
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

    async function clickVisible(xpath, timeoutMs = 10000, label = '') {
        await driver.wait(until.elementLocated(By.xpath(xpath)), timeoutMs);
        const element = await findFirstVisible(xpath);
        expect(element, `Không tìm thấy phần tử để click${label ? `: ${label}` : ''}`).to.not.equal(null);

        try {
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', element);
        } catch (e) { }

        // Prefer real user-like clicks first (JS click can be ignored by some UIs)
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

    async function setInputIfPresent(xpath, value) {
        const element = await findFirstVisible(xpath);
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
            // ignore; we'll fallback to JS setter below
        }

        // Always follow up with JS setter for React/controlled inputs
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

        // Verify not blank if we attempted to set a non-empty value
        try {
            const currentVal = String(await element.getAttribute('value') || '').trim();
            if (String(value).trim() && currentVal.length === 0) {
                // one more try: click + JS setter
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

    async function setInputRequired(xpath, value, label, minLen = 1) {
        const el = await findFirstVisible(xpath);
        expect(el, `Không tìm thấy input bắt buộc: ${label}`).to.not.equal(null);

        await setInputIfPresent(xpath, value);
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

    async function openDropdownAndPickRandom(openXpath, timeoutMs = 7000, label = '') {
        const openEl = await findFirstVisible(openXpath);
        if (!openEl) return false;
        await clickVisible(openXpath, timeoutMs, label);
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
                    // ignore
                }
            }
            if (candidates.length > 0) break; // stop at the first selector that returns visible options
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

    async function waitForAnyLocated(xpaths, timeoutMs = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            for (const xp of xpaths) {
                const el = await findFirstVisible(xp);
                if (el) return { xpath: xp, element: el };
            }
            await driver.sleep(300);
        }
        return null;
    }

    async function getPaymentRowByText(labelText) {
        const labelEl = await findFirstVisible(`//*[normalize-space(.)='${labelText}']`);
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

    async function isPaymentRowSelected(row) {
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

    async function clickPaymentByText(labelText) {
        const row = await getPaymentRowByText(labelText);
        if (!row) return null;
        try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', row.el); } catch (e) { }
        // Native click -> Actions click -> JS click
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

    async function isRadioChecked(radioEl) {
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

    async function selectQRPayment(timeoutMs = 15000) {
        const labelText = 'Chuyển khoản ngân hàng (QR Code)';
        const codLabelText = 'Thanh toán khi nhận hàng';
        await driver.wait(until.elementLocated(By.xpath(`//*[normalize-space(.)='${labelText}']`)), timeoutMs);

        // First: click exactly the QR option the user provided (click its button ancestor)
        try {
            const qrExact = await findFirstVisible(`${QR_CODE_XPATH}/ancestor::button[1] | ${QR_CODE_XPATH}`);
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
            // ignore, fall back to text-based method below
        }

        for (let i = 0; i < 5; i++) {
            const qrRow = await clickPaymentByText(labelText);
            // Some UIs only toggle if clicking the text itself (not just the row)
            try {
                const labelEl = qrRow ? qrRow.labelEl : await findFirstVisible(`//*[normalize-space(.)='${labelText}']`);
                if (labelEl) {
                    try { await labelEl.click(); } catch (e) {
                        try { await driver.actions({ async: true }).move({ origin: labelEl }).click().perform(); } catch (e2) { }
                    }
                    await driver.sleep(250);
                }
            } catch (e) { }

            const qrChecked = await isPaymentRowSelected(qrRow);
            const codRow = await getPaymentRowByText(codLabelText);
            const codChecked = await isPaymentRowSelected(codRow);
            console.log(`[PAY] attempt ${i + 1}: qrChecked=${qrChecked} codChecked=${codChecked}`);
            if (qrChecked && !codChecked) {
                // ensure it stays selected briefly (site sometimes flips back)
                await driver.sleep(1200);
                const qrStill = await isPaymentRowSelected(await getPaymentRowByText(labelText));
                const codStill = await isPaymentRowSelected(await getPaymentRowByText(codLabelText));
                if (qrStill && !codStill) return true;
            }

            // Retry: sometimes the UI re-renders and switches back to COD
            await driver.sleep(700);
        }

        // Diagnostics: detect if the option appears disabled / no radios present
        try {
            const header = await findFirstVisible("//*[normalize-space(.)='Phương thức thanh toán']");
            const paymentRoot = header
                ? await driver.executeScript(
                    `let el = arguments[0];
                                         for (let i=0;i<8 && el;i++){
                                             if (el.querySelector && (el.querySelector('input[type="radio"]') || el.querySelector('[role="radio"]'))) return el;
                                             el = el.parentElement;
                                         }
                                         return arguments[0].parentElement;`,
                    header
                )
                : null;

            const rowObj = await getPaymentRowByText(labelText);
            const row = rowObj ? rowObj.el : null;
            const info = await driver.executeScript(
                `const row = arguments[0];
                                 const root = arguments[1];
                                 const getAttr = (el, name) => el ? el.getAttribute(name) : null;
                                 const radios = root && root.querySelectorAll ? Array.from(root.querySelectorAll('input[type="radio"]')) : [];
                                 const roleRadios = root && root.querySelectorAll ? Array.from(root.querySelectorAll('[role="radio"]')) : [];
                                 const summarizeRadio = (r) => ({ name: r.name || null, value: r.value || null, checked: !!r.checked, disabled: !!r.disabled });
                                 const summarizeRole = (r) => ({ ariaChecked: getAttr(r,'aria-checked'), ariaDisabled: getAttr(r,'aria-disabled') });
                                 return {
                                     rowTag: row ? row.tagName : null,
                                     rowClass: row ? row.className : null,
                                     rowRole: getAttr(row,'role'),
                                     rowAriaChecked: getAttr(row,'aria-checked'),
                                     rowAriaDisabled: getAttr(row,'aria-disabled'),
                                     rowTabIndex: getAttr(row,'tabindex'),
                                     radiosCount: radios.length,
                                     checkedRadios: radios.filter(r => r.checked).map(summarizeRadio),
                                     roleRadiosCount: roleRadios.length,
                                     checkedRoleRadios: roleRadios.filter(r => String(getAttr(r,'aria-checked')).toLowerCase()==='true').map(summarizeRole),
                                 };
                                `,
                row,
                paymentRoot
            );
            console.log('[PAY][DIAG] QR option info:', JSON.stringify(info));
        } catch (e) {
            console.log('[PAY][DIAG] Could not collect QR disabled info:', String(e && e.message ? e.message : e));
        }

        // Best-effort only: continue to place order as user requested.
        console.log('[WARN] QR Code bị tự chuyển lại "Thanh toán khi nhận hàng". Vẫn tiếp tục bấm "Đặt hàng" để quan sát luồng.');
        return false;
    }

    async function waitForGatewaySignal(timeoutMs = 45000) {
        const start = Date.now();
        // IMPORTANT: keep markers specific to gateway/QR flow to avoid false positives on cart page.
        const gatewayMarkers = [
            "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
            "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]",
            "//*[contains(normalize-space(.), 'Quét hoặc tải mã QR') or contains(normalize-space(.), 'mã QR để thanh toán')]",
            "//form[contains(@action,'vnpay') or contains(@action,'pay') or contains(@action,'payment')]",
            "//img[contains(@alt,'VNPAY') or contains(@src,'vnpay')]",
            // Gateway sometimes loads in iframe
            "//iframe[contains(@src,'vnpay') or contains(@src,'pay') or contains(@src,'payment')]",
        ];

        while (Date.now() - start < timeoutMs) {
            const url = await driver.getCurrentUrl();
            if ((url.includes('vnpay') || url.includes('pay') || url.includes('payment') || url.includes('qr')) && !url.includes('gio-hang')) return true;

            for (const xp of gatewayMarkers) {
                const el = await findFirstVisible(xp);
                if (el) return true;
            }
            await driver.sleep(500);
        }
        return false;
    }

    async function waitForGatewayAfterPlaceOrder(originalUrl, timeoutMs = 90000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const handles = await driver.getAllWindowHandles();
            if (handles.length > 1) return { kind: 'new-window' };

            const url = await driver.getCurrentUrl();
            // Intermediate processing page: keep waiting until the actual QR/gateway UI appears.
            if (url && url.includes('giao-dich-dang-xu-ly')) {
                await driver.sleep(800);
                continue;
            }

            // If we landed on the payment page or gateway URL, wait for real gateway markers.
            if (url && !url.includes('gio-hang')) {
                const marker = await waitForGatewaySignal(1200);
                if (marker) return { kind: 'gateway', url };
            }

            // Only accept a marker if it looks like a real gateway.
            // Do NOT accept markers while still on gio-hang unless we see cancel button / gateway form / gateway iframe.
            const stillOnCart = url.includes('gio-hang');
            if (!stillOnCart) {
                // already handled above
            } else {
                // On cart/checkout page: only consider very strict markers
                const strictMarkers = [
                    "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
                    "//form[contains(@action,'vnpay') or contains(@action,'pay') or contains(@action,'payment')]",
                    "//iframe[contains(@src,'vnpay') or contains(@src,'pay') or contains(@src,'payment')]",
                ];
                for (const xp of strictMarkers) {
                    const el = await findFirstVisible(xp);
                    if (el) return { kind: 'marker', url };
                }
            }

            // user observed ~20s load: keep waiting
            await driver.sleep(1000);
        }
        return null;
    }

    async function acceptTermsIfPresent() {
        // Some checkouts require accepting terms/policies; try to check if present & unchecked.
        const termsCandidateXPath = [
            "//label[contains(., 'điều khoản') or contains(., 'Điều khoản') or contains(., 'chính sách') or contains(., 'Chính sách') or contains(., 'Tôi đồng ý') or contains(., 'tôi đồng ý')]",
            "//span[contains(., 'điều khoản') or contains(., 'Điều khoản') or contains(., 'chính sách') or contains(., 'Chính sách') or contains(., 'Tôi đồng ý') or contains(., 'tôi đồng ý')]",
        ].join(' | ');

        const label = await findFirstVisible(termsCandidateXPath);
        if (!label) return false;

        // Try to find a checkbox input near it
        const checkbox = await findFirstVisible("//input[@type='checkbox'][ancestor::label[contains(., 'điều khoản') or contains(., 'chính sách') or contains(., 'đồng ý')]] | //input[@type='checkbox'][preceding::*[contains(., 'điều khoản') or contains(., 'chính sách') or contains(., 'đồng ý')]][1]");
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

        // Fallback: click label itself
        try { await driver.executeScript('arguments[0].click();', label); } catch (e) { }
        await driver.sleep(400);
        return true;
    }

    async function pickRandomStoreFromAddressForm(timeoutMs = 20000) {
        // Opener is usually a clickable row with text: "Chọn shop có hàng gần nhất"
        const chooseStoreBtnXPath = [
            "//*[@id='address-form']/div[2]/div//button",
            "//*[@id='address-form']//button[contains(., 'Chọn') and (contains(., 'shop') or contains(., 'Shop') or contains(., 'cửa hàng') or contains(., 'Cửa hàng'))]",
            "//*[contains(normalize-space(.), 'Chọn shop có hàng gần nhất')]/ancestor::button[1]",
            "//*[contains(normalize-space(.), 'Chọn shop có hàng gần nhất')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
            "//*[contains(normalize-space(.), 'Chọn shop') and contains(normalize-space(.), 'gần nhất')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
            "//input[contains(@placeholder,'Chọn shop') or contains(@placeholder,'shop') or contains(@placeholder,'cửa hàng')]/ancestor::div[contains(@class,'cursor-pointer')][1]",
        ].join(' | ');

        await clickVisible(chooseStoreBtnXPath, timeoutMs, 'Mở chọn shop');
        await driver.sleep(700);

        // Store picker is rendered in an overlay (often under /html/body/div[12]/...)
        const storeCardXPaths = [
            // Use the overlay structure the user shared
            "/html/body/div[12]/div[2]/div[2]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
            "/html/body/div[12]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
            "//div[contains(@class,'fixed') and contains(@class,'z-')]//div[contains(@class,'cursor-pointer')][.//p[contains(.,'Shop') or contains(.,'shop')]]",
            // Fallback: any store card-like clickable item inside the overlay
            "//div[contains(@class,'fixed') and contains(@class,'z-')]//div[contains(@class,'cursor-pointer') and contains(@class,'bg-white')]",
        ];

        const ready = await waitForAnyLocated(storeCardXPaths, 15000);
        if (!ready) return false;

        // Collect all visible store cards from the first matching XPath
        const found = await driver.findElements(By.xpath(ready.xpath));
        const candidates = [];
        for (const el of found) {
            try {
                if (!(await el.isDisplayed())) continue;
                const text = (await el.getText()).replace(/\s+/g, ' ').trim();
                if (!text) continue;
                // Avoid selecting the opener text if it somehow appears in overlay
                if (/chọn\s+shop\s+có\s+hàng\s+gần\s+nhất/i.test(text)) continue;
                candidates.push({ el, text });
            } catch (e) {
                // ignore
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

        // Some flows require an explicit confirm button to finalize store selection
        const confirmStoreXPath = [
            "/html/body/div[12]/div[2]/div[2]/div/div[2]/button",
            "//div[contains(@class,'fixed') and contains(@class,'z-')]//button[contains(., 'Xác nhận') or contains(., 'Chọn') or contains(., 'Hoàn tất') or contains(., 'Đồng ý')]",
        ].join(' | ');
        const confirmBtn = await findFirstVisible(confirmStoreXPath);
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

    async function addProductToCart() {
        const categoryUrl = 'https://fptshop.com.vn/may-tinh-xach-tay';
        const cartUrl = 'https://fptshop.com.vn/gio-hang';
        const quantityInputXPath = "//input[@min='1'] | //input[contains(@class, 'text-center') and @type='text']";

        for (let attempt = 1; attempt <= 6; attempt++) {
            await driver.get(categoryUrl);
            await waitForBody(15000);
            await driver.sleep(1500);

            const productXPath = `(//div[contains(@class, 'product-info')]//h3 | //h3[contains(@class,'line-clamp')])[${attempt}]`;
            const product = await driver.wait(until.elementLocated(By.xpath(productXPath)), 15000);
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', product);
            await driver.executeScript('arguments[0].click();', product);
            await driver.sleep(2500);

            await driver.executeScript('window.scrollTo(0, 800);');
            await driver.sleep(800);

            // Try Mua ngay first, fallback to Thêm vào giỏ
            const buyNowXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mua ngay')]";
            const addToCartXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thêm vào giỏ')]";

            let clicked = false;
            const buyEl = await findFirstVisible(buyNowXPath);
            if (buyEl) {
                try { await driver.executeScript('arguments[0].click();', buyEl); } catch (e) { await buyEl.click(); }
                clicked = true;
            } else {
                const addEl = await findFirstVisible(addToCartXPath);
                if (addEl) {
                    try { await driver.executeScript('arguments[0].click();', addEl); } catch (e) { await addEl.click(); }
                    clicked = true;
                }
            }

            if (!clicked) {
                console.log(`[WARN] Không click được Mua ngay/Thêm vào giỏ (attempt ${attempt})`);
                continue;
            }

            await driver.sleep(2500);

            // If there's a mini-modal, click 'Đến giỏ hàng' / 'Xem giỏ hàng' if present
            const goCartXPath = "//a[contains(., 'Đến giỏ hàng') or contains(., 'Xem giỏ hàng')] | //button[contains(., 'Đến giỏ hàng') or contains(., 'Xem giỏ hàng')]";
            const goCartEl = await findFirstVisible(goCartXPath);
            if (goCartEl) {
                try { await driver.executeScript('arguments[0].click();', goCartEl); } catch (e) { await goCartEl.click(); }
                await driver.sleep(1500);
            }

            // Always land on cart and verify cart has at least one visible quantity input
            await driver.get(cartUrl);
            await driver.wait(until.urlContains('gio-hang'), 15000);
            await driver.sleep(1500);

            const inputs = await driver.findElements(By.xpath(quantityInputXPath));
            const visibleInputs = [];
            for (const input of inputs) {
                try { if (await input.isDisplayed()) visibleInputs.push(input); } catch (e) { }
            }

            if (visibleInputs.length > 0) {
                console.log(`[OK] Thêm sản phẩm vào giỏ thành công (attempt ${attempt}).`);
                return;
            }

            console.log(`[WARN] Giỏ hàng vẫn trống (attempt ${attempt}). Thử sản phẩm khác...`);
        }

        expect.fail('Giỏ hàng đang trống sau khi thử nhiều sản phẩm');
    }

    async function tryCancelOnGateway() {
        // Wait a bit for the QR/gateway UI to fully render
        await waitForAnyLocated([
            "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]",
            "//*[contains(normalize-space(.), 'Quét hoặc tải mã QR') or contains(normalize-space(.), 'mã QR để thanh toán')]",
            "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
        ], 15000);

        const cancelSmartXPath = [
            "/html/body/div[6]/div[1]/div[3]/div/button[2]",
            "//*[contains(normalize-space(.), 'Hủy giao dịch') or contains(normalize-space(.), 'Huỷ giao dịch')]/ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or contains(@class,'cursor-pointer')][1]",
            "//*[@id='btnCancel' or @id='cancel' or @name='cancel']",
        ].join(' | ');

        const smart = await findFirstVisible(cancelSmartXPath);
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

        // First attempt: main document
        const direct = await findFirstVisible(cancelXPath);
        if (direct) {
            await clickVisible(cancelXPath, 7000, 'Nút hủy giao dịch (main doc)');
            return true;
        }

        // Second attempt: scan iframes (some gateways embed content)
        const iframes = await driver.findElements(By.css('iframe'));
        for (const frame of iframes) {
            try {
                await driver.switchTo().frame(frame);
                const inFrame = await findFirstVisible(cancelXPath);
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

    async function assertPaymentFailedOrUnpaid() {
        // Try to open order detail if there is a link/button
        const orderDetailLinkXPath = "//a[contains(., 'Chi tiết đơn hàng')] | //a[contains(@href,'chi-tiet') or contains(@href,'don-hang') or contains(@href,'order')]";
        const detailLink = await findFirstVisible(orderDetailLinkXPath);
        if (detailLink) {
            try {
                await driver.executeScript('arguments[0].click();', detailLink);
                await driver.sleep(2000);
            } catch (e) { }
        }

        // Expected: order exists, status processing; payment failed/unpaid
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

    before(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc020');
        addContext(this, {
            title: this.currentTest.state === 'failed' ? 'Screenshot khi thất bại' : 'Bằng chứng thực thi',
            value: `../../${screenshotPath}`
        });
    });

    after(async function () {
        if (driver) await driver.quit();
    });

    it('Đặt hàng bằng QR code và hủy giao dịch', async function () {
        // 1) Bấm vào giỏ hàng + chọn sản phẩm (thêm 1 sản phẩm vào giỏ)
        await addProductToCart();
        console.log('Đã có sản phẩm trong giỏ hàng.');

        // 2) Tiến hành đặt hàng
        const checkoutBtnXPath = "//button[contains(., 'Xác nhận đơn')] | //button[contains(., 'Tiến hành đặt hàng')] | //button[contains(., 'Đặt hàng')]";
        await clickVisible(checkoutBtnXPath, 15000, 'Tiến hành đặt hàng');
        await driver.sleep(2000);

        // 3) Điền thông tin cá nhân (nếu có form)
        const filledName = await setInputIfPresent(
            "//*[@id='order-form']//input[@placeholder='Nhập họ tên'] | //*[@id='order-form']//input[contains(@placeholder,'Họ và tên')] | //*[@id='order-form']//input[contains(@placeholder,'họ và tên')] | //*[@id='order-form']//input[@id='name'] | //*[@id='order-form']//input[contains(@name,'name')] | //input[@placeholder='Nhập họ tên'] | //input[contains(@placeholder,'Họ và tên')] | //input[contains(@placeholder,'họ và tên')] | //input[@id='name'] | //input[contains(@name,'name')]",
            'Automation Test'
        );
        const phoneValue = `093${randomDigits(7)}`;
        const phoneXPath = "//input[@placeholder='Số điện thoại' or contains(@placeholder,'Số điện thoại') or contains(@placeholder,'số điện thoại') or contains(@placeholder,'điện thoại') or @id='phone' or contains(@name,'phone') or @type='tel' or @inputmode='numeric' or @inputmode='tel'][not(ancestor::*[@id='address-form']) and not(ancestor::div[contains(@class,'fixed') and contains(@class,'z-')]) and not(contains(@placeholder,'Tìm') or contains(@placeholder,'tìm') or contains(@placeholder,'shop') or contains(@placeholder,'Shop'))] | //*[self::label or self::span or self::p][contains(normalize-space(.), 'Số điện thoại')]/following::input[1]";
        const filledPhone = await setInputRequired(phoneXPath, phoneValue, 'Số điện thoại', 9);

        const fakeEmail = `automation.${Date.now()}@example.com`;
        const filledEmail = await setInputIfPresent(
            "//input[@type='email' or @id='email' or contains(@name,'email') or contains(@placeholder,'Email') or contains(@placeholder,'email')][not(ancestor::div[contains(@class,'fixed') and contains(@class,'z-')])]",
            fakeEmail
        );
        if (filledName || filledPhone) {
            console.log('Đã điền thông tin cá nhân (nếu hệ thống yêu cầu).');
            await driver.sleep(800);
        }
        if (filledEmail) {
            console.log(`Đã điền email: ${fakeEmail}`);
            await driver.sleep(400);
        }

        // 4) Chọn Nhận hàng tại cửa hàng + chọn cửa hàng
        const atStoreXPath = "//label[contains(., 'Nhận tại cửa hàng')] | //span[contains(., 'Nhận tại cửa hàng')]";
        await clickVisible(atStoreXPath, 15000, 'Nhận tại cửa hàng');
        await driver.sleep(1200);

        // Chọn cửa hàng từ address-form (tránh click nhầm dropdown khác như quà tặng)
        const addressFormReady = await waitForAnyLocated(["//*[@id='address-form']"], 15000);
        expect(addressFormReady, 'Không thấy form chọn cửa hàng (address-form) sau khi chọn "Nhận tại cửa hàng"').to.not.equal(null);

        const pickedStore = await pickRandomStoreFromAddressForm(25000);
        console.log(`Chọn cửa hàng: ${pickedStore}`);
        expect(pickedStore, 'Không chọn được shop có hàng gần nhất').to.equal(true);

        // 5) Chọn Chuyển khoản ngân hàng (QR code) (best-effort)
        const qrSelected = await selectQRPayment(20000);
        console.log(`QR selected: ${qrSelected}`);
        await driver.sleep(500);

        // Sau khi chọn QR, bấm nút bước tiếp theo (user-provided XPath)
        const nextStepXPath = "/html/body/main/section/div/div[2]/div[2]/div/div/button";
        const nextBtn = await findFirstVisible(nextStepXPath);
        if (nextBtn) {
            let btnText = '';
            try { btnText = (await nextBtn.getText()).trim(); } catch (e) { }
            // Only treat it as a separate "next" if it isn't the final "Đặt hàng/Hoàn tất" button.
            const looksLikeFinal = /đặt hàng|hoàn tất|thanh toán/i.test(btnText);
            if (!looksLikeFinal) {
                try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', nextBtn); } catch (e) { }
                try { await driver.executeScript('arguments[0].click();', nextBtn); } catch (e) { await nextBtn.click(); }
                await driver.sleep(1200);
                // Some re-renders revert payment method; try to enforce QR again (best-effort)
                await selectQRPayment(15000);
                await driver.sleep(500);
            }
        }

        // 6) Bấm Hoàn tất đặt hàng / Thanh toán (use exact user-provided Dat hang XPath first)
        const finishBtnXPath = `${DAT_HANG_XPATH} | //button[contains(., 'Hoàn tất đặt hàng')] | //button[contains(., 'THANH TOÁN')] | //button[contains(., 'Thanh toán')] | //button[contains(., 'Đặt hàng')]`;
        const originalHandle = await driver.getWindowHandle();
        const beforePlaceUrl = await driver.getCurrentUrl();

        await acceptTermsIfPresent();

        // Prefer clicking the exact checkout button the user provided
        const exactDatHang = await findFirstVisible(DAT_HANG_XPATH);
        if (exactDatHang) {
            try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', exactDatHang); } catch (e) { }
            try {
                await exactDatHang.click();
            } catch (e1) {
                try {
                    await driver.actions({ async: true }).move({ origin: exactDatHang }).click().perform();
                } catch (e2) {
                    await driver.executeScript('arguments[0].click();', exactDatHang);
                }
            }
        } else {
            await clickVisible(finishBtnXPath, 20000, 'Đặt hàng');
        }

        console.log('Đã nhấn Hoàn tất đặt hàng. Chờ điều hướng sang cổng thanh toán...');
        const progressed = await waitForGatewayAfterPlaceOrder(beforePlaceUrl, 90000);
        expect(progressed, 'Không thấy trang/QR thanh toán sau khi đặt hàng (có thể bị validation hoặc cần đăng nhập)').to.not.equal(null);

        const handles = await driver.getAllWindowHandles();
        if (handles.length > 1) {
            const next = handles.find(h => h !== originalHandle);
            if (next) {
                await driver.switchTo().window(next);
                await driver.sleep(1000);
            }
        }

        const gatewayUrl = await driver.getCurrentUrl();
        expect(gatewayUrl.includes('gio-hang')).to.equal(false, 'Vẫn ở trang giỏ hàng sau khi đặt hàng (có thể click chưa trúng nút, bị validation, hoặc chưa điều hướng sang cổng thanh toán)');
        // Give the gateway page time to finish loading (user observed ~20s)
        const okGateway = await waitForGatewaySignal(20000);
        expect(okGateway, 'Đã đặt hàng nhưng không thấy UI QR/cổng thanh toán sau 20s').to.equal(true);

        console.log('Trang hiện tại sau đặt hàng (kỳ vọng cổng/QR): ' + gatewayUrl);

        // 7) Hủy giao dịch
        const canceled = await tryCancelOnGateway();
        console.log(canceled ? 'Đã click nút Hủy giao dịch.' : '[WARN] Không tìm thấy nút Hủy trên cổng thanh toán, sẽ kiểm tra redirect/message.');

        // After cancelling, wait for either a redirect away from the QR page or for failure/unpaid texts to appear.
        if (canceled) {
            const beforeCancelUrl = await driver.getCurrentUrl();
            await driver.wait(async () => {
                const url = await driver.getCurrentUrl();
                if (url !== beforeCancelUrl) return true;
                const failText = await findFirstVisible("//*[contains(., 'thất bại') or contains(., 'chưa thanh toán') or contains(., 'không thành công')]");
                return !!failText;
            }, 60000);
            await driver.sleep(1500);
        }

        const afterUrl = await driver.getCurrentUrl();
        console.log('URL sau khi hủy: ' + afterUrl);

        // Verify: Đơn ở trạng thái xử lý + thanh toán thất bại / chưa thanh toán
        await assertPaymentFailedOrUnpaid();
    });
});
