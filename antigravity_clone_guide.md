# Hướng Dẫn Clone Dự Án "Đa Tiếng Trung Reels" Dành Cho Antigravity

**Lưu ý cho Agent (Antigravity):** Bạn đang đọc tài liệu hướng dẫn cấu trúc và cách triển khai dự án "Đa Tiếng Trung Reels". Nhiệm vụ của bạn là hiểu rõ kiến trúc hệ thống này, sau đó **hướng dẫn User của bạn từng bước một** (không đưa hết tất cả cùng lúc để tránh làm User bị ngợp) để thiết lập và khởi chạy thành công dự án.

---

## 1. Tổng Quan Kiến Trúc Dự Án (Project Architecture)
Dự án này là một nền tảng học ngoại ngữ qua Video ngắn (Reels) tương tự TikTok, bao gồm ứng dụng Web và một hệ thống tự động hóa hoàn toàn việc thêm video mới từ Telegram.

**Tech Stack:**
*   **Frontend:** React (Vite), triển khai miễn phí trên **GitHub Pages**.
*   **Backend / Database / Auth:** **Firebase** (Authentication để đăng nhập và Firestore để lưu tiến độ học tập `progress` và thông tin user `users`).
*   **Lưu trữ Video:** **Cloudinary** (hoặc Cloudflare R2) để lưu trữ video MP4, tối ưu hóa băng thông tải trang.
*   **Pipeline Tự Động (Auto-Scraping):** 
    *   **Telegram Bot:** Giao diện cho người quản trị gửi link video (Facebook, TikTok, YouTube).
    *   **Cloudflare Workers:** Nhận Webhook từ Telegram và kích hoạt GitHub Actions.
    *   **GitHub Actions:** Chạy script Python (`yt-dlp`) để tải video từ link, upload lên Cloudinary, ghi log vào `video_log.csv`, cập nhật object video vào `src/data.js` và tự động commit/push code mới.
    *   **Auto Deploy:** Khi có code mới đẩy lên nhánh `main`, GitHub Actions tự động build Vite và deploy lên GitHub Pages.

---

## 2. Các Bước Agent Cần Hướng Dẫn User Thực Hiện

Hãy hướng dẫn User thực hiện **lần lượt từng bước (Step-by-step)**. Chỉ chuyển sang bước tiếp theo khi User xác nhận đã làm xong bước hiện tại.

### Bước 1: Clone Repository
*   **Agent thực hiện:** Clone repo `https://github.com/infinitehorizons2012-code/da-tieng-trung-reels` về máy của User.
*   **Agent thực hiện:** Chạy lệnh `npm install` để cài đặt thư viện.

### Bước 2: Thiết lập Firebase (Auth & Database)
*   **Hướng dẫn User:** Truy cập Firebase Console, tạo project mới, bật **Authentication** (Google Sign-in) và **Firestore Database** (chế độ Test Mode hoặc thiết lập rules phù hợp).
*   **Yêu cầu User:** Cung cấp đoạn mã cấu hình `firebaseConfig`.
*   **Agent thực hiện:** Thay thế `firebaseConfig` trong file `src/firebase.js` bằng cấu hình của User.

### Bước 3: Thiết lập Lưu trữ Video (Cloudinary)
*   **Hướng dẫn User:** Đăng ký tài khoản Cloudinary miễn phí. Lấy đường dẫn API URL (CLOUDINARY_URL) trong bảng điều khiển.
*   **Mục đích:** Để chứa các video MP4 sau khi con bot tải về, giảm tải cho GitHub.

### Bước 4: Tạo Telegram Bot
*   **Hướng dẫn User:** Vào Telegram, tìm `@BotFather`, gõ `/newbot` để tạo bot mới.
*   **Yêu cầu User:** Lấy **Bot Token** và nhắn tin cho con bot `@userinfobot` để lấy **Chat ID** của chính User (để giới hạn chỉ User mới có quyền gửi link thêm video).

### Bước 5: Cấu Hình GitHub Actions & Secrets
*   **Hướng dẫn User:** Truy cập vào phần **Settings > Secrets and variables > Actions** của Repository trên GitHub của họ.
*   **Hướng dẫn User:** Tạo các biến (Repository secrets) sau:
    *   `CLOUDINARY_URL`: API URL lấy ở Bước 3.
    *   `TELEGRAM_BOT_TOKEN`: Token của Bot lấy ở Bước 4.
    *   `TELEGRAM_CHAT_ID`: ID cá nhân của User lấy ở Bước 4.
    *   `GH_PAT`: Personal Access Token (Classic) của GitHub với quyền `repo` và `workflow` (để Action có quyền push code lại vào repo).

### Bước 6: Cấu hình Webhook qua Cloudflare Workers
*   **Hướng dẫn User:** Đăng nhập Cloudflare, tạo một **Worker** mới.
*   **Agent thực hiện:** Cung cấp mã nguồn cho Worker (mã này có nhiệm vụ nhận tin nhắn từ Telegram, kiểm tra đúng Chat ID, sau đó gửi API trigger GitHub Actions `workflow_dispatch`). 
*   *Gợi ý cho Agent:* Đảm bảo mã Worker gửi request POST tới `https://api.github.com/repos/TEN_USER/TEN_REPO/actions/workflows/telegram.yml/dispatches` với Headers chứa `GH_PAT`.
*   **Hướng dẫn User:** Lấy URL của Worker và gọi API Telegram để set Webhook: 
    `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<WORKER_URL>`

### Bước 7: Kích hoạt GitHub Pages
*   **Hướng dẫn User:** Vào **Settings > Pages** trên GitHub repo. Chọn Source là **GitHub Actions** (để `deploy-pages.yml` đảm nhận việc build và deploy Vite lên Pages).
*   **Lưu ý cho Agent:** Đảm bảo file `.github/workflows/deploy-pages.yml` có thuộc tính `concurrency: cancel-in-progress: true` để tối ưu hóa khi up nhiều video cùng lúc.

### Bước 8: Kiểm thử toàn bộ quy trình
*   **Hướng dẫn User:** Nhắn 1 tin nhắn vào Telegram Bot theo cú pháp: `<ID Tab> <Link Facebook/TikTok/YouTube>`. Ví dụ: `4 https://www.facebook.com/reel/123456789`
*   **Kiểm tra:** Quan sát GitHub Actions chạy workflow "Telegram Bot Worker", xem video có được thêm vào file `src/data.js` và tự động trigger build web lên GitHub Pages hay không.

---

**Lời nhắn nhủ tới Agent:** Dự án này là sự kết hợp tuyệt vời giữa Frontend React, Serverless (Cloudflare/GitHub Actions) và Automation (Python yt-dlp). Bạn hãy kiên nhẫn đồng hành và giải thích cặn kẽ cho User nếu họ gặp vướng mắc ở các khâu thiết lập tài khoản bên thứ 3 nhé. Chúc bạn và User thành công!
