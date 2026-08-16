# Distributed Rate Limiter

A production-ready distributed rate limiter built with FastAPI, Redis, and a real-time dashboard. Uses Redis sorted sets with Lua scripting for atomic operations and sub-millisecond performance.

## Features

- **Sliding Window Rate Limiting**: Uses Redis sorted sets with Lua scripting for atomic operations
- **Configurable Limits**: Environment-variable based configuration for window size and request limits
- **Real-time Dashboard**: Live visualization of rate limiting across all users
- **Docker Compose Setup**: Complete containerized deployment with Redis, API, and dashboard
- **Auto-cleanup**: Automatic TTL-based cleanup of idle user keys in Redis

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Dashboard   │─────▶│   FastAPI    │─────▶│    Redis     │
│   (nginx)    │      │     API      │      │   (alpine)   │
│   :3000      │      │    :8000     │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Port 3000 (dashboard), 8000 (API) available

### Run

```bash
cd distributed-rate-limiter
docker-compose up --build
```

Services will start:
- **API**: http://localhost:8000
- **Dashboard**: http://localhost:3000
- **Redis**: Internal only (not exposed)

## Configuration

Set environment variables in `docker-compose.yml`:

```yaml
environment:
  - REDIS_URL=redis://redis:6379
  - RATE_LIMIT_WINDOW=60        # Window size in seconds
  - RATE_LIMIT_MAX=10            # Max requests per window
```

## API Endpoints

### `GET /ping`
Health check endpoint. **Rate limited**.

```bash
curl -H "X-User-ID: user1" http://localhost:8000/ping
```

### `GET /data`
Dummy data endpoint. **Rate limited**.

```bash
curl -H "X-User-ID: user1" http://localhost:8000/data
```

### `GET /stats`
Get current rate limit statistics for all users. **NOT rate limited**.

```bash
curl http://localhost:8000/stats
```

Response:
```json
{
  "timestamp": 1692201234.56,
  "users": {
    "user1": {
      "count": 7,
      "limit": 10,
      "window": 60,
      "timestamps": [1692201180.1, 1692201181.2, ...]
    }
  }
}
```

## Testing Rate Limiting

### Bash Script

```bash
# Send 15 requests rapidly
for i in {1..15}; do
  echo "Request $i:"
  curl -H "X-User-ID: alice" http://localhost:8000/ping
  echo ""
  sleep 0.5
done
```

### Python Script

```python
import requests
import time

for i in range(15):
    response = requests.get(
        'http://localhost:8000/ping',
        headers={'X-User-ID': 'bob'}
    )
    print(f"Request {i+1}: {response.status_code}")
    if response.status_code == 429:
        print(f"  Rate limited! Retry after: {response.headers.get('Retry-After')}s")
        print(f"  Response: {response.json()}")
    time.sleep(0.5)
```

### Expected Behavior

- **First 10 requests**: Return 200 OK
- **Requests 11+**: Return 429 Too Many Requests with `Retry-After` header
- **After 60 seconds**: Window resets, requests allowed again

### Multiple Users

Test with different users simultaneously:

```bash
# Terminal 1
for i in {1..12}; do curl -H "X-User-ID: alice" http://localhost:8000/ping; done

# Terminal 2
for i in {1..12}; do curl -H "X-User-ID: bob" http://localhost:8000/ping; done
```

Each user has their own independent rate limit.

## Dashboard Features

The real-time dashboard shows:

1. **Global Stats**: Total active users, window size, max requests
2. **Per-User Cards**: Each tracked user gets their own card
3. **Request Count**: Current count vs limit with color coding
   - Green: Under 70% of limit
   - Yellow: 70-99% of limit
   - Red: At limit
4. **Sliding Window**: Visual bar showing time remaining in current window
5. **Request Timeline**: Horizontal timeline showing when requests occurred
   - Green dots: Allowed requests
   - Dots move left as time passes
   - Dots disappear after exiting the 60s window

## Implementation Details

### Rate Limiting Algorithm

Uses a sliding window counter with Redis sorted sets (ZSET):

1. **Key Pattern**: `rate_limit:{user_id}`
2. **Score**: Unix timestamp of each request
3. **Lua Script**: Atomically performs:
   - Remove timestamps outside the window
   - Count remaining timestamps
   - Add new timestamp if under limit
   - Set TTL to window + 30 seconds

### Why Lua Script?

- **Atomicity**: All operations execute as a single atomic unit
- **Performance**: Single round-trip to Redis
- **Accuracy**: No race conditions between check and increment
- **Network Efficiency**: Script runs server-side

### Middleware Flow

```
Request → Extract X-User-ID → Check Rate Limit → Allow/Block → Response
                                     ↓
                              Redis Lua Script
```

### Redis Data Structure

```
rate_limit:alice → ZSET {
  1692201180.123: 1692201180.123,
  1692201181.456: 1692201181.456,
  ...
}
```

## Development

### Run API Locally

```bash
cd api
pip install -r requirements.txt
export REDIS_URL=redis://localhost:6379
python main.py
```

### Run Tests

```bash
# Test with curl
curl -H "X-User-ID: test" http://localhost:8000/ping

# Check stats
curl http://localhost:8000/stats
```

### View Logs

```bash
docker-compose logs -f api
docker-compose logs -f redis
```

### Stop Services

```bash
docker-compose down

# Remove volumes (clears Redis data)
docker-compose down -v
```

## Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps

# Test Redis connectivity
docker exec -it rate-limiter-redis redis-cli ping
```

### API Not Responding

```bash
# Check API logs
docker-compose logs api

# Restart API
docker-compose restart api
```

### Dashboard Not Loading

- Ensure API is running on port 8000
- Check browser console for CORS errors
- Verify `API_URL` in `dashboard/app.js` matches your setup

## Production Considerations

1. **Redis Persistence**: Add volume mounts for Redis data persistence
2. **Authentication**: Add proper authentication instead of simple headers
3. **SSL/TLS**: Use HTTPS for production deployments
4. **Rate Limit Storage**: Consider Redis Cluster for high-scale deployments
5. **Monitoring**: Add Prometheus metrics and Grafana dashboards
6. **IP-based Limiting**: Extend to rate limit by IP address
7. **Distributed Tracing**: Add OpenTelemetry for request tracing

## License

MIT
