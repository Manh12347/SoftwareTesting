const addContext = require('mochawesome/addContext');

const testerByModule = {
    'Module 1': 'Lê Ngọc Đăng Khoa',
    'Module 2': 'Quách Đắc Đức Mạnh',
    'Module 3': 'Lê Tấn Đạt',
    'Module 4': 'Nguyễn Huỳnh Minh Tâm'
};

function resolveTester(filePath = '') {
    const match = Object.entries(testerByModule).find(([moduleName]) => filePath.includes(moduleName));
    return match ? match[1] : 'Không xác định';
}

function formatDateTime(date) {
    return date.toLocaleString('vi-VN', { hour12: false });
}

exports.mochaHooks = {
    beforeEach() {
        if (this.currentTest) {
            this.currentTest.ctx.testStartTime = new Date();
        }
    },

    afterEach() {
        if (!this.currentTest) {
            return;
        }

        const tester = resolveTester(this.currentTest.file || '');
        const startTime = this.currentTest.ctx.testStartTime || new Date();
        const endTime = new Date();

        addContext(this, {
            title: 'Tester',
            value: tester
        });

        addContext(this, {
            title: 'Start time',
            value: formatDateTime(startTime)
        });

        addContext(this, {
            title: 'End time',
            value: formatDateTime(endTime)
        });
    }
};