FastAPI backend for restFlow

Quick start (use a venv):

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Endpoints:
- GET / --> health check
- POST /workflow/run --> accepts a JSON payload describing a workflow; returns a simple echo/result
- POST /upload --> file upload (multipart/form-data)

Notes: This is a minimal template. Extend with authentication, CORS, and production server config when needed.
