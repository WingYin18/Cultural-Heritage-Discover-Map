FROM python:3.9-slim

WORKDIR /app

# 先安裝套件，利用 Docker Cache 加快以後建置的速度
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端所有檔案
COPY . .

# 0.0.0.0 是為了讓 Docker 外部（你的電腦）能連進去
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]