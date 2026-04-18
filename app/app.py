import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import search

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(
    title="Manifesto API",
    version="1.0.0",
    description="Manifesto api for semantic search and vector database management.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

app.include_router(search.router,
    prefix="/api/v1",  tags=["Search something in manifesto"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


if __name__ == '__main__':
    config = uvicorn.Config("app.main:app", port=8080, host="0.0.0.0", workers=4)
    server = uvicorn.Server(config)
    server.run()