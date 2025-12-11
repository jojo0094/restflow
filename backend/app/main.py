from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .models import Workflow
from . import tools

app = FastAPI(title="restFlow backend")

# allow local frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health():
    return {"status": "ok"}

@app.post("/workflow/run")
async def run_workflow(workflow: Workflow):
    # placeholder: implement orchestration or execution
    result = {"nodes": len(workflow.nodes), "edges": len(workflow.edges), "message": "received"}
    return JSONResponse(content=result)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # minimal handling: read small files into memory
    contents = await file.read()
    size = len(contents)
    return {"filename": file.filename, "size": size}

# include tools router
app.include_router(tools.router)
