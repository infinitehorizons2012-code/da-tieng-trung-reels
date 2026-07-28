import os
import json
import subprocess
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
import cloudinary
import cloudinary.uploader

# --- CẤU HÌNH ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = 'service_account.json'
SPREADSHEET_ID = os.environ.get('SHEET_ID')

# Lưu ý: CLOUDINARY_URL sẽ tự động được thư viện cloudinary nhận diện từ biến môi trường

def get_max_id(data_content):
    ids = re.findall(r'id:\s*(\d+)', data_content)
    if not ids:
        return 0
    return max(int(id) for id in ids)

def main():
    if not SPREADSHEET_ID:
        print("Lỗi: Thiếu SHEET_ID trong môi trường.")
        return

    # 1. Khởi tạo Google API credentials (Chỉ cần cho Sheets)
    creds_json = os.environ.get('GOOGLE_CREDENTIALS')
    if not creds_json:
        print("Lỗi: Thiếu GOOGLE_CREDENTIALS.")
        return
        
    with open(SERVICE_ACCOUNT_FILE, 'w') as f:
        f.write(creds_json)
        
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        
    sheets_service = build('sheets', 'v4', credentials=creds)

    # 2. Đọc dữ liệu từ Google Sheet (Sheet1)
    sheet = sheets_service.spreadsheets()
    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='Sheet1!A2:G').execute()
    values = result.get('values', [])

    if not values:
        print('Không có dữ liệu trong Sheet.')
        return

    new_videos = []
    
    # Đọc src/data.js hiện tại để lấy max ID
    data_js_path = 'src/data.js'
    try:
        with open(data_js_path, 'r', encoding='utf-8') as f:
            data_content = f.read()
            current_id = get_max_id(data_content)
    except Exception:
        data_content = "export const reelsData = [\n];"
        current_id = 0

    updates = []
    
    for row_idx, row in enumerate(values):
        row.extend([''] * (7 - len(row)))
        link, title, pinyin, vi, views, likes, status = row[:7]
        
        if status.lower() == 'done' or not link.strip():
            continue
            
        print(f"Đang xử lý: {title} - {link}")
        
        # 3. Tải video bằng yt-dlp
        file_name = f"video_{row_idx}.mp4"
        try:
            subprocess.run(['yt-dlp', '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4', '-o', file_name, link], check=True)
        except Exception as e:
            print(f"Lỗi tải video {link}: {e}")
            try:
                subprocess.run(['yt-dlp', '-o', file_name, link], check=True)
            except:
                print("Thất bại hoàn toàn.")
                continue

        if not os.path.exists(file_name):
            continue

        # 4. Upload lên Cloudinary
        print("Đang tải lên Cloudinary...")
        try:
            # resource_type="video" là bắt buộc đối với file mp4
            upload_result = cloudinary.uploader.upload(file_name, resource_type="video", folder="da-tieng-trung")
            direct_link = upload_result.get('secure_url')
            print(f"Tải lên thành công: {direct_link}")
        except Exception as e:
            print(f"Lỗi upload Cloudinary: {e}")
            os.remove(file_name)
            continue
        
        # Xóa file local sau khi upload
        os.remove(file_name)
        
        # 5. Cập nhật trạng thái
        row_number = row_idx + 2
        updates.append({
            'range': f'Sheet1!G{row_number}',
            'values': [['Done']]
        })
        
        current_id += 1
        
        if not views: views = "1,2K"
        if not likes: likes = "500"
        
        new_video_obj = f"""  {{
    id: {current_id},
    title: "{title}",
    pinyin: "{pinyin}",
    vietnamese: "{vi}",
    image: "", 
    videoUrl: "{direct_link}",
    views: "{views}",
    likes: "{likes}"
  }}"""
        new_videos.append(new_video_obj)

    # 6. Cập nhật lại Sheet
    if updates:
        body = {'valueInputOption': 'USER_ENTERED', 'data': updates}
        sheet.values().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
        print("Đã cập nhật Sheet.")

    # 7. Cập nhật file src/data.js
    if new_videos:
        last_bracket = data_content.rfind(']')
        if last_bracket != -1:
            needs_comma = "{" in data_content[:last_bracket]
            
            insert_str = ""
            if needs_comma:
                insert_str += ",\n"
            insert_str += ",\n".join(new_videos) + "\n"
            
            new_content = data_content[:last_bracket] + insert_str + data_content[last_bracket:]
            with open(data_js_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Đã cập nhật src/data.js")
            
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        os.remove(SERVICE_ACCOUNT_FILE)

if __name__ == '__main__':
    main()
