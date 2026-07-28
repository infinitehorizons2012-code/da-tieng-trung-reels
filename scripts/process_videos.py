import os
import json
import subprocess
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import urllib.parse
import re

# --- CẤU HÌNH ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'service_account.json'
SPREADSHEET_ID = os.environ.get('SHEET_ID')
DRIVE_FOLDER_ID = os.environ.get('DRIVE_FOLDER_ID')

# Hàm lấy ID video từ file chạy
def get_max_id(data_content):
    ids = re.findall(r'id:\s*(\d+)', data_content)
    if not ids:
        return 0
    return max(int(id) for id in ids)

def main():
    if not SPREADSHEET_ID or not DRIVE_FOLDER_ID:
        print("Lỗi: Thiếu SHEET_ID hoặc DRIVE_FOLDER_ID trong môi trường.")
        return

    # 1. Khởi tạo Google API credentials
    creds_json = os.environ.get('GOOGLE_CREDENTIALS')
    if not creds_json:
        print("Lỗi: Thiếu GOOGLE_CREDENTIALS.")
        return
        
    with open(SERVICE_ACCOUNT_FILE, 'w') as f:
        f.write(creds_json)
        
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        
    sheets_service = build('sheets', 'v4', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)

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
        # Cấu trúc: [Link Video, Tiêu đề (Hán), Pinyin, Tiếng Việt, Lượt xem ảo, Tim ảo, Trạng thái]
        # Bổ sung các cột nếu thiếu
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
            # Thử lại tải chất lượng cơ bản
            try:
                subprocess.run(['yt-dlp', '-o', file_name, link], check=True)
            except:
                print("Thất bại hoàn toàn.")
                continue

        if not os.path.exists(file_name):
            continue

        # 4. Upload lên Google Drive
        file_metadata = {
            'name': f"{title}.mp4",
            'parents': [DRIVE_FOLDER_ID]
        }
        media = MediaFileUpload(file_name, mimetype='video/mp4', resumable=True)
        file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        drive_file_id = file.get('id')
        print(f"Đã upload thành công lên Drive, ID: {drive_file_id}")
        
        # Set quyền public để ai cũng xem được (web stream được)
        drive_service.permissions().create(
            fileId=drive_file_id,
            body={'type': 'anyone', 'role': 'reader'},
            fields='id'
        ).execute()
        
        # 5. Cập nhật trạng thái
        row_number = row_idx + 2 # Do lấy từ A2
        updates.append({
            'range': f'Sheet1!G{row_number}',
            'values': [['Done']]
        })
        
        # Xóa file local
        os.remove(file_name)
        
        # Tạo object để thêm vào data.js
        current_id += 1
        direct_link = f"https://drive.google.com/uc?export=download&id={drive_file_id}"
        
        # Nếu chưa có view/likes, tạo mặc định
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
        # Tìm vị trí ngoặc vuông đóng cuối cùng
        last_bracket = data_content.rfind(']')
        if last_bracket != -1:
            # Nếu mảng đang rỗng thì không cần dấu phẩy
            needs_comma = "{" in data_content[:last_bracket]
            
            insert_str = ""
            if needs_comma:
                insert_str += ",\n"
            insert_str += ",\n".join(new_videos) + "\n"
            
            new_content = data_content[:last_bracket] + insert_str + data_content[last_bracket:]
            with open(data_js_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Đã cập nhật src/data.js")
            
    # Cleanup
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        os.remove(SERVICE_ACCOUNT_FILE)

if __name__ == '__main__':
    main()
