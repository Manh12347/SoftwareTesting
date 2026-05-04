const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const data = require('../../data/data.json');

async function openWeb(driver) {
    await driver.get(data.module1.url);
}

async function handleLogin(driver) {
    const loginBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.loginBtn)),
        10000,
        'Không tìm thấy nút đăng nhập'
    );
    await loginBtn.click();

    const originalWindow = await driver.getWindowHandle();
    await driver.wait(async () => (await driver.getAllWindowHandles()).length === 2, 10000);

    const windows = await driver.getAllWindowHandles();
    for (const handle of windows) {
        if (handle !== originalWindow) {
            await driver.switchTo().window(handle);
            break;
        }
    }

    // Chờ popup Google load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Tìm Google button trực tiếp
    const escBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.escBtn)),
        15000,
        'Không tìm thấy nút Google'
    );
    await escBtn.click();

    // Tìm Google button trực tiếp
    const googleBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.googleBtn)),
        15000,
        'Không tìm thấy nút Google'
    );
    await googleBtn.click();

    try {
        const accountBtn = await driver.wait(
            until.elementLocated(By.xpath(data.module1.selectors.accountBtn)),
            5000,
            'Không tìm thấy nút tài khoản'
        );
        await accountBtn.click();
    } catch (error) {
        console.log('Popup đóng nhanh, đang chuyển về tab chính...');
    }

    await driver.switchTo().window(originalWindow);
}

async function handleLogout(driver) {
    const profileBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.profileBtn)),
        10000,
        'Không tìm thấy nút hồ sơ'
    );

    const actions = driver.actions({ bridge: true });
    await actions.move({ origin: profileBtn }).perform();

    const logOutBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.logOutBtn)),
        10000,
        'Không tìm thấy nút đăng xuất'
    );
    await logOutBtn.click();

    const confirmBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.confirmBtn)),
        10000,
        'Không tìm thấy nút xác nhận'
    );
    await confirmBtn.click();
}

async function watchProfile(driver) {
    const profileBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.profileBtn)),
        10000,
        'Không tìm thấy nút hồ sơ'
    );

    const actions = driver.actions({ bridge: true });
    await actions.move({ origin: profileBtn }).perform();

    const generalBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.generalBtn)),
        10000,
        'Không tìm thấy nút Tổng quan'
    );
    await generalBtn.click();

    const profileDetailBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.profileDetailBtn)),
        10000,
        'Không tìm thấy nút chi tiết hồ sơ'
    );
    await profileDetailBtn.click();
    
    // Thêm delay để trang profile load xong
    await new Promise(resolve => setTimeout(resolve, 2000));
}

function checkValue(field, expected, actual, mismatches, details) {
    const normalizedExpected = String(expected || '').trim();
    const normalizedActual = String(actual || '').trim();
    const pass = normalizedActual === normalizedExpected;

    if (!pass) {
        mismatches[field] = { expected, actual };
    }

    details.push({ field, pass, expected, actual });
}

async function checkProfile(driver, expected) {
    const details = [];
    const mismatches = {};

    // Chờ để input fields visible
    await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.profileNameInput)),
        15000
    );

    const nameEl = await driver.findElement(By.xpath(data.module1.selectors.profileNameInput));
    checkValue('name', expected.name, await nameEl.getAttribute('value'), mismatches, details);

    const emailEl = await driver.findElement(By.xpath(data.module1.selectors.profileEmailInput));
    checkValue('email', expected.email, await emailEl.getAttribute('value'), mismatches, details);

    const phoneEl = await driver.findElement(By.xpath(data.module1.selectors.profilePhoneInput));
    checkValue('phone', expected.phone, await phoneEl.getAttribute('value'), mismatches, details);

    const dobDayEl = await driver.findElement(By.xpath(data.module1.selectors.dobDayBtn));
    checkValue('DateOfBirth', expected.DateOfBirth, await dobDayEl.getText(), mismatches, details);

    const dobMonthEl = await driver.findElement(By.xpath(data.module1.selectors.dobMonthBtn));
    checkValue('MonthOfBirth', expected.MonthOfBirth, await dobMonthEl.getText(), mismatches, details);

    const dobYearEl = await driver.findElement(By.xpath(data.module1.selectors.dobYearBtn));
    checkValue('YearOfBirth', expected.YearOfBirth, await dobYearEl.getText(), mismatches, details);

    const isMale = await driver.findElement(By.xpath(data.module1.selectors.genderMaleLabel)).isSelected().catch(() => false);
    checkValue('gender', expected.gender, isMale ? 'Nam' : 'Nữ', mismatches, details);

    return { ok: Object.keys(mismatches).length === 0, mismatches, details };
}

async function changeProfile(driver, changes) {
    // Chờ để input fields visible
    await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.profileNameInput)),
        15000
    );

    if (changes.name && String(changes.name).trim() !== '') {
        const nameEl = await driver.findElement(By.xpath(data.module1.selectors.profileNameInput));
        await nameEl.clear();
        await nameEl.sendKeys(String(changes.name));
    }

    if (changes.email && String(changes.email).trim() !== '') {
        const emailEl = await driver.findElement(By.xpath(data.module1.selectors.profileEmailInput));
        await emailEl.clear();
        await emailEl.sendKeys(String(changes.email));
    }

    if (changes.phone && String(changes.phone).trim() !== '') {
        const phoneEl = await driver.findElement(By.xpath(data.module1.selectors.profilePhoneInput));
        await phoneEl.clear();
        await phoneEl.sendKeys(String(changes.phone));
    }

    if (changes.DateOfBirth && String(changes.DateOfBirth).trim() !== '') {
        await driver.findElement(By.xpath(data.module1.selectors.dobDayBtn)).click();
    }

    if (changes.MonthOfBirth && String(changes.MonthOfBirth).trim() !== '') {
        await driver.findElement(By.xpath(data.module1.selectors.dobMonthBtn)).click();
    }

    if (changes.YearOfBirth && String(changes.YearOfBirth).trim() !== '') {
        await driver.findElement(By.xpath(data.module1.selectors.dobYearBtn)).click();
    }

    if (changes.gender && String(changes.gender).trim() !== '') {
        if (String(changes.gender).trim() === 'Nam') {
            await driver.findElement(By.xpath(data.module1.selectors.genderMaleLabel)).click();
        } else {
            await driver.findElement(By.xpath(data.module1.selectors.genderEmailLabel)).click();
        }
    }

    const saveProfileBtn = await driver.wait(
        until.elementLocated(By.xpath(data.module1.selectors.saveProfileBtn)),
        10000,
        'Không tìm thấy nút lưu hồ sơ'
    );
    await saveProfileBtn.click();
}

async function changeProfile1(driver, changes) {
    await changeProfile(driver, changes);
}

async function resetProfile(driver) {
    // Reset profile về trạng thái gốc
    await changeProfile(driver, data.module1.profileCheck);
}

module.exports = {
    openWeb,
    handleLogin,
    handleLogout,
    watchProfile,
    checkProfile,
    changeProfile,
    changeProfile1,
    resetProfile
};
