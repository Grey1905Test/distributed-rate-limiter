from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from middleware import RateLimitMiddleware
from rate_limiter import get_all_stats
import time

app = FastAPI(
    title="Distributed Rate Limiter",
    description="Rate limiting service with Redis backend",
    version="1.0.0"
)

# CORS middleware for dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)


@app.get("/ping")
async def ping():
    """
    Health check endpoint. Rate limited.
    """
    return {
        "status": "ok",
        "timestamp": time.time(),
        "message": "pong"
    }


@app.get("/data")
async def get_data():
    """
    Dummy data endpoint. Rate limited.
    """
    return {
        "data": [
            {"id": 1, "name": "Item 1", "value": 100},
            {"id": 2, "name": "Item 2", "value": 200},
            {"id": 3, "name": "Item 3", "value": 300},
        ],
        "timestamp": time.time(),
        "message": "Here's your data"
    }


@app.get("/stats")
async def get_stats():
    """
    Get current rate limit statistics for all users. NOT rate limited.
    """
    return {
        "timestamp": time.time(),
        "users": get_all_stats()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
