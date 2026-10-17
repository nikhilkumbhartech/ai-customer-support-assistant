from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import chat, ingest

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.backend_url, settings.client_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(chat.router)


@app.get("/")
def root():
    return {"service": settings.app_name, "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
