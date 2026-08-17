from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from rate_limiter import check_rate_limit, log_request


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces rate limiting on all requests except /stats endpoint.
    Extracts user ID from X-User-ID header and blocks requests exceeding the limit.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for stats endpoint
        if request.url.path == "/stats":
            return await call_next(request)
        
        # Extract user ID from header
        user_id = request.headers.get("X-User-ID")
        
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing X-User-ID header"}
            )
        
        # Check rate limit
        allowed, current_count, retry_after = check_rate_limit(user_id)
        
        if not allowed:
            # Log blocked request
            log_request(user_id, False, request.url.path, current_count)
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "current_count": current_count,
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(check_rate_limit.__globals__["RATE_LIMIT_MAX"]),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        # Log allowed request
        log_request(user_id, True, request.url.path, current_count)
        
        # Add rate limit headers to successful response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(check_rate_limit.__globals__["RATE_LIMIT_MAX"])
        response.headers["X-RateLimit-Remaining"] = str(check_rate_limit.__globals__["RATE_LIMIT_MAX"] - current_count)
        
        return response
