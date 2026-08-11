FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Don't bake a default — let docker-compose / env wire this in
ENV ATLAS_BASE_URL="http://web:3000"
ENV WINWORK_SCRAPE_SECRET=""
ENV SCRAPE_INTERVAL_HOURS="24"

CMD ["python", "-u", "src/run.py"]
