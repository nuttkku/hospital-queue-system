// 🔧 จัดการ async error ใน Express 4 ให้ส่งต่อไปที่ error middleware
module.exports = function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
