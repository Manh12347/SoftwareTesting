const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const addContext = require('mochawesome/addContext');
const { closeBanner, closeCookieBanner } = require('../../function/functions/helper');
const { takeScreenshot } = require('../../function/screenshotHelper');
const data = require('../../data/data.json');

describe('TC010: Bình luận sản phẩm', function () {
    this.timeout(90000);
    let driver;

    beforeEach(async function () {
        driver = await new Builder().forBrowser('chrome').build();
        await driver.manage().window().maximize();
    });

    afterEach(async function () {
        if (this.currentTest.state === 'failed') {
            const screenshotPath = await takeScreenshot(driver, this.currentTest.title, 'tc010');
            addContext(this, {
                title: 'Screenshot khi thất bại.',
                value: `../${screenshotPath}`
            });
        }
        if (driver) {
            await driver.quit();
        }
    });

    it('Gửi bình luận sản phẩm thành công', async function () {
        await driver.get(data.shared.url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await closeBanner(driver);
        await closeCookieBanner(driver);

        // Bước 1: Click vào sản phẩm trên trang chủ
        // XPath nâng cao: tìm sản phẩm
        const productXPath = "//h3[contains(@class,'line-clamp')]";
        const productElement = await driver.wait(
            until.elementLocated(By.xpath(productXPath)),
            10000,
            'Không tìm thấy sản phẩm'
        );
        const productName = await productElement.getText();
        console.log('Product clicked:', productName);
        await driver.executeScript('arguments[0].click();', productElement);

        // Bước 2: Đợi trang detail load
        await driver.wait(function() {
            return driver.getCurrentUrl().then(function(url) {
                return url.includes('/p/') || url.includes('product') || url !== data.shared.url;
            });
        }, 10000, 'Không chuyển sang trang detail');
        
        const firstWord = productName.split(' ')[0];
        const detailTitleXPath = `//h1[contains(text(),'${firstWord}')]`;
        await driver.wait(until.elementLocated(By.xpath(detailTitleXPath)), 10000, 'Title không load');
        await driver.sleep(500);
        
        const detailTitle = await driver.findElement(By.xpath(detailTitleXPath));
        const detailProductName = await detailTitle.getText();
        console.log('Detail product name:', detailProductName);

        // Bước 3: Scroll xuống dưới để tìm phần bình luận
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
        await driver.sleep(1000);

        // Tìm textarea để nhập bình luận - tìm tất cả textarea rồi lọc
        const allTextareas = await driver.findElements(By.xpath("//textarea"));
        console.log('Found textareas:', allTextareas.length);
        
        let commentTextarea = null;
        for (let textarea of allTextareas) {
            const placeholder = await textarea.getAttribute('placeholder');
            console.log('Textarea placeholder:', placeholder);
            if (placeholder && placeholder.includes('bình luận')) {
                commentTextarea = textarea;
                break;
            }
        }
        
        if (!commentTextarea) {
            throw new Error('Không tìm thấy textarea bình luận');
        }
        
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', commentTextarea);
        await driver.sleep(500);

        // Click để focus vào textarea
        await commentTextarea.click();
        await driver.sleep(300);


        // Nhập bình luận
        await commentTextarea.sendKeys(data.module2.commentData.comment);
        console.log('Đã nhập nội dung bình luận:', data.module2.commentData.comment);

        // Đợi 3 giây sau khi nhập nội dung
        await driver.sleep(3000);

        // Bước 4: Tìm nút gửi bình luận - tìm tất cả button gần textarea
        await driver.sleep(500);

        // Tìm button trong cùng container với textarea
        const submitButtonXPath = "(//textarea[contains(@placeholder,'Nhập')]/ancestor::*[contains(@class,'flex')]//button)[last()]";
        let submitButton;
        try {
            submitButton = await driver.wait(
                until.elementLocated(By.xpath(submitButtonXPath)),
                5000
            );
        } catch (e) {
            // Thử XPath khác - tìm button bất kỳ gần textarea
            console.log('Thử XPath khác...');
            const allButtons = await driver.findElements(By.xpath("//button"));
            console.log('Tổng số button trên trang:', allButtons.length);
            for (let i = 0; i < allButtons.length; i++) {
                const text = await allButtons[i].getText();
                console.log(`Button ${i}: "${text}"`);
                if (text && text.includes('Gửi')) {
                    submitButton = allButtons[i];
                    break;
                }
            }
        }

        if (!submitButton) {
            throw new Error('Không tìm thấy nút gửi bình luận');
        }

        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', submitButton);
        await driver.sleep(500);
        await driver.executeScript('arguments[0].click();', submitButton);
        console.log('Đã click nút gửi bình luận');

        // Bước 5: Đợi form thông tin người gửi xuất hiện (modal/popup) - đợi 5s
        await driver.sleep(5000);

        // Tìm form thông tin người gửi (class fixed)
        const formXPath = "//span[contains(text(),'Thông tin người gửi')]";
        const formTitle = await driver.wait(
            until.elementLocated(By.xpath(formXPath)),
            10000,
            'Form thông tin người gửi không xuất hiện'
        );
        console.log('Form thông tin người gửi đã mở');

        // Bước 6: Nhập họ và tên
        // XPath nâng cao: tìm input họ tên trong modal
        const nameInput = await driver.wait(
            until.elementLocated(By.xpath(
                "//input[@placeholder='Nhập họ và tên']"
            )),
            5000,
            'Không tìm thấy input họ tên'
        );
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', nameInput);
        await driver.sleep(300);
        await nameInput.sendKeys(data.module2.commentData.name);
        console.log('Đã nhập họ tên:', data.module2.commentData.name);

        // Bước 7: Nhập số điện thoại
        // XPath nâng cao: tìm input SDT
        const phoneInput = await driver.wait(
            until.elementLocated(By.xpath(
                "//input[@placeholder='Nhập số điện thoại']"
            )),
            5000,
            'Không tìm thấy input số điện thoại'
        );
        await phoneInput.sendKeys(data.module2.commentData.phone);
        console.log('Đã nhập SDT:', data.module2.commentData.phone);

        // Bước 8: Nhập Email
        // XPath nâng cao: tìm input email
        const emailInput = await driver.wait(
            until.elementLocated(By.xpath(
                "//input[@placeholder='Nhập Email (nhận thông báo phản hồi)']"
            )),
            5000,
            'Không tìm thấy input email'
        );
        await emailInput.sendKeys(data.module2.commentData.email);
        console.log('Đã nhập email:', data.module2.commentData.email);

        // Bước 9: Check checkbox đồng ý điều khoản
        // XPath nâng cao: tìm checkbox
        const checkbox = await driver.wait(
            until.elementLocated(By.xpath(
                "//input[@type='checkbox']"
            )),
            5000,
            'Không tìm thấy checkbox'
        );
        await checkbox.click();
        console.log('Đã check checkbox đồng ý điều khoản');

        // Bước 10: Click nút Hoàn tất
        // XPath nâng cao: tìm button Hoàn tất
        const completeButton = await driver.wait(
            until.elementLocated(By.xpath(
                "//button[normalize-space(.)='Hoàn tất']"
            )),
            5000,
            'Không tìm thấy nút Hoàn tất'
        );
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', completeButton);
        await driver.sleep(300);
        await driver.executeScript('arguments[0].click();', completeButton);
        console.log('Đã click nút Hoàn tất');

        // Bước 11: Verify bình luận đã được gửi thành công
        await driver.sleep(2000);

        // Verify bình luận đã xuất hiện
        expect(
            await driver.getPageSource().then(src => src.includes(data.module2.commentData.comment)),
            'Bình luận không được gửi thành công'
        ).to.be.true;

        // Scroll lên chỗ nhập bình luận để chụp hình bình luận đã gửi
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', commentTextarea);
        await driver.sleep(500);
        // Scroll thêm một chút để thấy bình luận đã gửi bên dưới
        await driver.executeScript('window.scrollBy(0, 200);');
        await driver.sleep(300);

        const screenshotPath = await takeScreenshot(driver, this.test.title, 'tc010');
        addContext(this, {
            title: 'Bình luận sản phẩm',
            value: `../../${screenshotPath}`
        });
    });
});
