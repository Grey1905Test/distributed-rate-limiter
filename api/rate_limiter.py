import redis
import os
import time
import uuid
import json
from typing import Tuple, List, Dict

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "10"))

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

LUA_RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- Remove timestamps outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests in window
local current = redis.call('ZCARD', key)

if current < limit then
    -- Add new timestamp with unique ID
    redis.call('ZADD', key, now, ARGV[5])
    -- Set TTL on key
    redis.call('EXPIRE', key, ttl)
    return {1, current + 1}
else
    -- Get oldest timestamp to calculate retry-after
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = math.ceil((tonumber(oldest[2]) + window) - now)
    return {0, current, retry_after}
end
"""

rate_limit_script = redis_client.register_script(LUA_RATE_LIMIT_SCRIPT)


def check_rate_limit(user_id: str) -> Tuple[bool, int, int]:
    """
    Check if user is within rate limit.
    
    Args:
        user_id: User identifier
        
    Returns:
        Tuple of (allowed, current_count, retry_after_seconds)
        - allowed: True if request is allowed, False if blocked
        - current_count: Number of requests in current window
        - retry_after_seconds: Seconds until next request allowed (0 if allowed)
    """
    key = f"rate_limit:{user_id}"
    now = time.time()
    ttl = RATE_LIMIT_WINDOW + 30
    
    result = rate_limit_script(
        keys=[key],
        args=[now, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX, ttl, str(uuid.uuid4())]
    )
    
    allowed = bool(result[0])
    current_count = int(result[1])
    retry_after = int(result[2]) if len(result) > 2 else 0
    
    return allowed, current_count, retry_after


def log_request(user_id: str, allowed: bool, endpoint: str, current_count: int):
    """
    Log a request event for tracking and analytics.
    Keeps last 50 requests per user in Redis.
    
    Args:
        user_id: User identifier
        allowed: Whether the request was allowed or blocked
        endpoint: The endpoint that was accessed
        current_count: Current request count in window
    """
    log_key = f"request_log:{user_id}"
    request_data = {
        "timestamp": time.time(),
        "allowed": allowed,
        "endpoint": endpoint,
        "count": current_count,
        "status": "allowed" if allowed else "blocked"
    }
    
    # Add to list
    redis_client.lpush(log_key, json.dumps(request_data))
    
    # Keep only last 50 requests
    redis_client.ltrim(log_key, 0, 49)
    
    # Set expiry (slightly longer than rate limit window)
    redis_client.expire(log_key, RATE_LIMIT_WINDOW + 300)


def get_request_logs(user_id: str, limit: int = 20) -> List[Dict]:
    """
    Get recent request logs for a user.
    
    Args:
        user_id: User identifier
        limit: Maximum number of logs to return
        
    Returns:
        List of request log entries
    """
    log_key = f"request_log:{user_id}"
    logs = redis_client.lrange(log_key, 0, limit - 1)
    
    return [json.loads(log) for log in logs]


def get_all_stats() -> dict:
    """
    Get rate limit statistics for all tracked users.
    
    Returns:
        Dictionary mapping user_id to their request timestamps and logs
    """
    stats = {}
    now = time.time()
    
    # Find all rate limit keys
    for key in redis_client.scan_iter(match="rate_limit:*"):
        user_id = key.split(":", 1)[1]
        
        # Clean up old entries
        redis_client.zremrangebyscore(key, 0, now - RATE_LIMIT_WINDOW)
        
        # Get timestamps in current window
        timestamps = redis_client.zrange(key, 0, -1, withscores=True)
        
        if timestamps:
            stats[user_id] = {
                "count": len(timestamps),
                "limit": RATE_LIMIT_MAX,
                "window": RATE_LIMIT_WINDOW,
                "timestamps": [float(score) for _, score in timestamps],
                "recent_requests": get_request_logs(user_id, limit=20)
            }
    
    return stats
