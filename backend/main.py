from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import requests
import os

app = FastAPI()
sites=[]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # 允許所有來源
    allow_credentials=False,      # 當 origins 為 ["*"] 時，這裡建議設為 False
    allow_methods=["*"],           # 允許所有方法 (GET, POST, OPTIONS 等)
    allow_headers=["*"],           # 允許所有 Header
)

API_URL = "https://portal.csdi.gov.hk/server/services/common/devb_wb_rcd_1639040299687_46105/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=DM_20260130_150858&outputFormat=geojson&count=10000"



@app.get("/get_processed_data")
async def get_processed_data():
    global sites  # 宣告使用全域變數
    try:
        response = requests.get(API_URL)
        response.encoding = 'utf-8'
        response.raise_for_status()
        data = response.json()

        # ✨ 關鍵修正：每次請求時先清空列表，防止重複累積
        sites.clear() 

        for feature in data.get("features", []):
            coords = feature['geometry']['coordinates'][0][0][0]
            props = feature['properties']
            site = {
                "nameEN": props.get('NAME'),
                "nameTC": props.get('NAME_TC'),
                "lng": coords[0],
                "lat": coords[1],
                "addressEN": props.get('ADDRESS'),
                "addressTC": props.get('ADDRESS_TC'),
                "imageUrl": props.get('URL_IMAGE'),
                "decYear": props.get('DEC_YEAR')
            }
            sites.append(site) 

        print(f"Successfully processed {len(sites)} sites.") # 這裡現在應該固定顯示 170 左右
        return sites

    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

@app.post("/recommend")
async def recommend_heritage(data: dict):
    try:
        user_query = data.get("query")
        
        # 既然 170 筆沒問題，我們就傳送完整的 sites
        # 但建議還是過濾掉一些 AI 不需要的大型欄位（如 imageUrl），以節省傳輸量
        context_str = json.dumps(sites, ensure_ascii=False)

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "nvidia/nemotron-3-nano-30b-a3b:free",
                "messages": [
                    {
                        "role": "system", 
                        "content": (
                            "你是一個香港歷史專家。以下是香港歷史建築數據 Array:\n"
                            f"{context_str}\n\n"
                            "請根據用戶要求從中挑選一個最適合的建築。回傳 JSON 格式，每個內容必須[英文(繁體中文)]：\n"
                            "{\"name\": \"建築名稱\", \"reason\": \"推薦理由\", \"district\": \"地區\", \"address\": \"地址\"}"
                        )
                    },
                    {"role": "user", "content": user_query}
                ],
                "response_format": { "type": "json_object" }
            }),
            timeout=30
        )
        response.raise_for_status()
        result_json = response.json()
        
        if result_json and "choices" in result_json:
            ai_reply = result_json['choices'][0]['message']['content']
            return {"reply": ai_reply}
        
        return {"reply": "AI's return format is incorrect AI 回傳格式不正確... "}

    except Exception as e:
        print(f"💥 Backend Crash: {str(e)}")
        return {"reply": f"System Failure 系統發生錯誤: {str(e)}"}