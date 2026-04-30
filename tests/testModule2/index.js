// Chạy tất cả test trong testModule2
// Command: npx mocha testModule2/*.test.js --reporter mochawesome

module.exports = {
    // Các test case:
    // - tc1_timkiem_laptop.test.js: Tìm kiếm với từ khóa "Laptop"
    // - tc2_timkiem_khong_tim_thay.test.js: Tìm kiếm với từ khóa không tồn tại
    // - tc3_validation_tim_kiem.test.js: Validation khi không nhập từ khóa
    // - tc4_them_san_pham_gio_hang.test.js: Thêm sản phẩm vào giỏ hàng
    // - tc5_so_luong_vuot_gioi_han.test.js: Kiểm tra giới hạn số lượng 9999
};
