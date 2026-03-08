"""
NYC Google CBS — FastAPI Backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, api, live

app = FastAPI(
    title="NYC Google CBS API",
    version="0.1.0",
)

# CORS — allow the Next.js frontend (default dev port 3000)
# Note: WebSocket connections are not subject to CORS, but we keep
# the origin in allow_origins so the upgrade request is not blocked.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(api.router, prefix="/api")
app.include_router(live.router)


@app.get("/")
async def root():
    return {"message": "NYC Google CBS API is running."}
