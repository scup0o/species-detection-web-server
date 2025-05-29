const app = require('./app'); // Giả sử app.js nằm cùng cấp hoặc đường dẫn đúng
const config = require('../config/index'); // Đường dẫn đến file config của bạn

async function startLocalServer() {
    try {
        const PORT = config.app.port || process.env.PORT || 3000; // Ưu tiên config, rồi PORT từ env, rồi 3000
        const HOSTNAME = config.app.hostname || 'localhost'; // Mặc định là localhost nếu không có trong config

        app.listen(PORT, HOSTNAME, () => {
            console.log(`🚀 Local server is running at http://${HOSTNAME}:${PORT}/`);
            console.log(`🔗 API V1 (local): http://${HOSTNAME}:${PORT}/api/v1`); // Ví dụ
        });
    } catch (error) {
        console.error("❌ Failed to start local server:", error);
        process.exit(1); // Thoát nếu không khởi động được server local
    }
}

// Kiểm tra xem có đang chạy trên Vercel hay một môi trường serverless tương tự không
// Vercel thường set biến môi trường VERCEL=1 hoặc NOW_REGION
// Hoặc bạn có thể kiểm tra một biến môi trường bạn tự đặt khi deploy
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT);

if (!IS_SERVERLESS) {
    // Chỉ gọi startLocalServer nếu không phải môi trường serverless
    startLocalServer();
} else {
    console.log("🌐 Running in serverless environment (Vercel, etc.). HTTP server will be managed by the platform.");
}

// QUAN TRỌNG: Export instance của Express app để Vercel (hoặc các nền tảng khác) sử dụng
module.exports = app;