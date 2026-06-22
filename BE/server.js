// Nạp biến môi trường từ file .env vào bộ nhớ RAM ngay dòng đầu tiên
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import các tuyến đường (routes)
const authRoutes = require('./src/routes/authRoutes');
const documentRoutes = require("./src/routes/documentRoutes");
const app = express();
const aiRoutes = require("./src/routes/aiRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const workspaceRoutes = require("./src/routes/workspaceRoutes");
const userRoutes = require("./src/routes/userRoutes");

// 1. Cấu hình Middleware CORS để cho phép Frontend (Vite - 5173) gọi API
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
    ], // Địa chỉ của Frontend
    credentials: true // Cho phép gửi token/cookie nếu có
}));

// 2. Middleware phân tích cú pháp JSON từ body của request
app.use(express.json());

// 3. Gắn các tuyến đường (Mount Routes)
// Tất cả các request bắt đầu bằng /api/auth sẽ được chuyển cho authRoutes xử lý
app.use('/api/auth', authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/users", userRoutes);

// Route test để kiểm tra xem server có sống không
app.get('/', (req, res) => {
    res.send('AI StudyHub Backend đang chạy!');
});

// 4. Khởi động Server và lắng nghe trên cổng 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[🚀 Server] Đã khởi động thành công. Đang lắng nghe tại http://localhost:${PORT}`);
});
