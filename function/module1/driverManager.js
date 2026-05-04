const {
    Builder,
    Browser
} = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');

/**
 * Khởi tạo WebDriver
 * @returns {WebDriver} Selenium WebDriver instance
 */
async function initializeDriver() {
    const options = new edge.Options();

    options.addArguments("--user-data-dir=C:/Users/ADMIN/AppData/Local/Microsoft/Edge/User Data");
    options.addArguments("--profile-directory=Default");
    options.addArguments('--remote-debugging-port=0');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-first-run');
    options.addArguments('--no-default-browser-check');
    options.addArguments('--disable-web-resources');

    const driver = await new Builder().forBrowser(Browser.EDGE).setEdgeOptions(options).build();

    return driver;
}

module.exports = { initializeDriver };
