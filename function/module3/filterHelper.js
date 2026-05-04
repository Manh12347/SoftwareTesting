const { By, until } = require('selenium-webdriver');
const { closeCookieBanner } = require('../functions/helper');


async function clickBrand(driver, brandName) {
    await closeCookieBanner(driver);
    const element = await driver.wait(
        until.elementLocated(By.xpath(`//img[@alt='${brandName}']`)),
        10000
    );
    await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", element);
    await driver.wait(until.elementIsVisible(element), 5000);
    await driver.executeScript("arguments[0].click();", element);
    await driver.wait(until.elementLocated(By.xpath("//h3")), 10000);
    return element;
}

module.exports = { closeCookieBanner, clickBrand };
