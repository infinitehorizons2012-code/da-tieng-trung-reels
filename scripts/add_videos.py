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
VIDEO_URLS_STR = os.environ.get('VIDEO_URLS', '[]')
CHAT_ID = os.environ.get('CHAT_ID')

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

# Phân tích danh sách URL từ Webhook
try:
    urls = json.loads(VIDEO_URLS_STR)
except:
    # Fallback to string matching if JSON fails
    urls = re.findall(r'(https?://[^\s\'"\[\],]+)', VIDEO_URLS_STR)

if not urls or not CHAT_ID:
    print("No URLs or CHAT_ID found in payload.")
    exit(0)

print(f"Found {len(urls)} videos to process.")

# Hàm tải video bằng yt-dlp
def download_video(url, output_path="temp_video.mp4"):
    try:
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

ids = re.findall(r'id:\s*(\d+)', data_js_content)
next_id = max([int(i) for i in ids]) + 1 if ids else 1

new_entries = []
log_entries = []

for video_url in urls:
    send_telegram_msg(CHAT_ID, f"Đang bắt đầu xử lý video: {video_url}")
    
    downloaded_file = download_video(video_url)
    
    if not downloaded_file:
        send_telegram_msg(CHAT_ID, f"Lỗi: Không thể tải video từ link {video_url}")
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Failed Download", ""])
        continue
        
    try:
        send_telegram_msg(CHAT_ID, "Đang tải video lên Cloudinary...")
        upload_result = cloudinary.uploader.upload(
            downloaded_file, 
            resource_type="video", 
            folder="da-tieng-trung"
        )
        final_url = upload_result.get('secure_url')
        
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
        
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Success", final_url])
        
        send_telegram_msg(CHAT_ID, f"✅ Đã thêm Video số {next_id} thành công vào hệ thống!\nVideo sẽ xuất hiện trên web sau khoảng 1-2 phút.")
        next_id += 1
        
        os.remove(downloaded_file)
        
    except Exception as e:
        print(f"Error uploading to Cloudinary: {str(e)}")
        send_telegram_msg(CHAT_ID, f"Lỗi: Không thể đẩy lên Cloudinary - {str(e)}")
        log_entries.append([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), video_url, "Failed Upload", str(e)])

# Cập nhật data.js
if new_entries:
    new_data_str = ",\n" + ",\n".join(new_entries) + "\n];"
    updated_content = re.sub(r'\n\];$', new_data_str, data_js_content, count=1)
    
    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)

# Ghi log
csv_path = 'video_log.csv'
file_exists = os.path.exists(csv_path)
with open(csv_path, 'a', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    if not file_exists:
        writer.writerow(['Thời gian', 'Link gốc', 'Trạng thái', 'Link Cloudinary (Web)'])
    for row in log_entries:
        writer.writerow(row)
