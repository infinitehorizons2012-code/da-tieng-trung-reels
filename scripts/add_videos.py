import os
import requests
import re
import json
import subprocess
import cloudinary
import cloudinary.uploader
import csv
from datetime import datetime

TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
CLOUDINARY_URL = os.environ.get('CLOUDINARY_URL') # Format: cloudinary://apikey:apisecret@cloudname

if not TELEGRAM_TOKEN:
    print("No TELEGRAM_TOKEN found.")
    exit(0)

# Configure Cloudinary if URL is provided
if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)
else:
    print("No CLOUDINARY_URL found.")
    exit(0)

def send_telegram_msg(chat_id, text):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    requests.post(url, json={'chat_id': chat_id, 'text': text})

# 1. Lấy tin nhắn mới từ Telegram (Polling)
url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates"
offset = 0
try:
    with open('scripts/telegram_offset.txt', 'r') as f:
        offset = int(f.read().strip())
except:
    pass

res = requests.get(url, params={'offset': offset, 'timeout': 10})
data = res.json()

if not data.get('ok') or not data.get('result'):
    print("No new updates from Telegram.")
    exit(0)

new_offset = offset
videos_to_process = []

for update in data['result']:
    new_offset = max(new_offset, update['update_id'] + 1)
    if 'message' in update and 'text' in update['message']:
        text = update['message']['text']
        chat_id = update['message']['chat']['id']
        # Tìm tất cả các link web trong tin nhắn
        urls = re.findall(r'(https?://[^\s]+)', text)
        for u in urls:
            videos_to_process.append({'url': u, 'chat_id': chat_id})

if not videos_to_process:
    # Cập nhật offset nếu có tin nhắn nhưng không chứa link
    with open('scripts/telegram_offset.txt', 'w') as f:
        f.write(str(new_offset))
    exit(0)

print(f"Found {len(videos_to_process)} videos to process.")

# Hàm tải video bằng yt-dlp
def download_video(url, output_path="temp_video.mp4"):
    try:
        # Cố gắng xóa file cũ nếu còn tồn tại
        if os.path.exists(output_path):
            os.remove(output_path)
            
        print(f"Downloading {url} ...")
        cmd = ['yt-dlp', '-f', 'b', '-o', output_path, url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and os.path.exists(output_path):
            return output_path
        else:
            print("Download failed:", result.stderr)
            return None
    except Exception as e:
        print(f"Error downloading {url}: {str(e)}")
        return None

# Đọc data.js hiện tại để lấy max ID
data_js_path = 'src/data.js'
try:
    with open(data_js_path, 'r', encoding='utf-8') as f:
        data_js_content = f.read()
except FileNotFoundError:
    print("data.js not found!")
    exit(1)

# Lấy các ID hiện có
ids = re.findall(r'id:\s*(\d+)', data_js_content)
next_id = max([int(i) for i in ids]) + 1 if ids else 1

new_entries = []
log_entries = []

for item in videos_to_process:
    video_url = item['url']
    chat_id = item['chat_id']
    send_telegram_msg(chat_id, f"Đang bắt đầu xử lý video: {video_url}")
    
    downloaded_file = download_video(video_url)
    
    if not downloaded_file:
        send_telegram_msg(chat_id, f"Lỗi: Không thể tải video từ link {video_url}")
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Failed Download", ""])
        continue
        
    try:
        send_telegram_msg(chat_id, "Đang tải video lên Cloudinary...")
        # Upload lên Cloudinary thư mục da-tieng-trung
        upload_result = cloudinary.uploader.upload(
            downloaded_file, 
            resource_type="video", 
            folder="da-tieng-trung"
        )
        final_url = upload_result.get('secure_url')
        
        # Tạo entry cho data.js
        entry = f"""  {{
    id: {next_id},
    title: "",
    pinyin: "",
    vietnamese: "",
    image: "", 
    videoUrl: "{final_url}",
    views: "0",
    likes: "0"
  }}"""
        new_entries.append(entry)
        
        # Cập nhật log
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Success", final_url])
        
        send_telegram_msg(chat_id, f"✅ Đã thêm Video số {next_id} thành công vào hệ thống!\nVideo sẽ xuất hiện trên web sau khoảng 1-2 phút.")
        next_id += 1
        
        # Xóa file tạm
        os.remove(downloaded_file)
        
    except Exception as e:
        print(f"Error uploading to Cloudinary: {str(e)}")
        send_telegram_msg(chat_id, f"Lỗi: Không thể đẩy lên Cloudinary - {str(e)}")
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Failed Upload", str(e)])


# Nếu có video mới, cập nhật data.js
if new_entries:
    # Tìm đoạn cuối mảng trong data.js: "];"
    new_data_str = ",\n" + ",\n".join(new_entries) + "\n];"
    updated_content = re.sub(r'\n\];$', new_data_str, data_js_content, count=1)
    
    # Ghi lại data.js
    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)

# Ghi nhật ký tải video
csv_path = 'video_log.csv'
file_exists = os.path.exists(csv_path)
with open(csv_path, 'a', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    if not file_exists:
        writer.writerow(['Thời gian', 'Link gốc', 'Trạng thái', 'Link Cloudinary (Web)'])
    for row in log_entries:
        writer.writerow(row)

# Cuối cùng, cập nhật offset để không xử lý lại tin nhắn cũ
with open('scripts/telegram_offset.txt', 'w') as f:
    f.write(str(new_offset))
