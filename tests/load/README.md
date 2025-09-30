# Load Testing with k6

**Task**: T078 - Performance and load testing for Oriva Platform

## Overview

This directory contains k6 load testing scripts for validating the Oriva Platform backend performance under various load conditions.

## Prerequisites

### Install k6

**macOS**:
```bash
brew install k6
```

**Linux**:
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows**:
```powershell
choco install k6
```

## Test Scripts

### 1. Smoke Test (`smoke-test.js`)

Quick validation test with minimal load to verify basic functionality.

**Load Profile**:
- 5 concurrent users
- 2 minute duration
- Tests: Health check, conversation creation, chat messages

**Usage**:
```bash
# Local testing
k6 run smoke-test.js

# Production testing
k6 run --env BASE_URL=https://api.oriva.ai smoke-test.js
```

**When to use**:
- Before deployments to verify basic functionality
- After configuration changes
- Quick validation of new features

### 2. Chat Load Test (`chat-load-test.js`)

Comprehensive load test simulating realistic user behavior with 100+ concurrent users.

**Load Profile**:
- Ramp up: 0 → 50 → 100 users over 5 minutes
- Sustained: 100 users for 10 minutes
- Peak: 150 users for 3 minutes
- Ramp down: 150 → 0 over 4 minutes
- **Total duration**: ~24 minutes
- **Target**: 1000+ messages per minute at peak

**Scenarios tested**:
- Conversation creation
- Chat message exchange (2-4 messages per conversation)
- Knowledge base search
- Health checks

**Custom metrics tracked**:
- `chat_response_time`: Chat API response times
- `knowledge_search_time`: Knowledge search latency
- `token_usage`: AI token consumption
- `slow_responses`: Responses > 5 seconds
- `rate_limit_hits`: 429 rate limit responses

**Usage**:
```bash
# Local testing
k6 run chat-load-test.js

# Production testing with environment variables
k6 run \
  --env BASE_URL=https://api.oriva.ai \
  --env API_KEY=your-api-key \
  --env APP_ID=hugo-matchmaker \
  --env TEST_RUN_ID=prod-load-test-$(date +%s) \
  chat-load-test.js

# Output results to JSON
k6 run --out json=results.json chat-load-test.js
```

## Performance Thresholds

### HTTP Metrics
- **p95 response time**: < 1000ms
- **p99 response time**: < 3000ms
- **Error rate**: < 1%
- **HTTP failure rate**: < 5%

### Custom Metrics
- **Chat response time p95**: < 3000ms
- **Chat response time p99**: < 5000ms
- **Knowledge search average**: < 500ms
- **Knowledge search p95**: < 1000ms

## Running Tests

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | `http://localhost:3000` |
| `API_KEY` | API authentication key | `test-api-key` |
| `APP_ID` | Application ID | `hugo-matchmaker` |
| `TEST_RUN_ID` | Unique test run identifier | `unknown` |

### Local Development

1. Start local server:
   ```bash
   npm run dev
   ```

2. Run smoke test:
   ```bash
   k6 run smoke-test.js
   ```

3. Run full load test:
   ```bash
   k6 run chat-load-test.js
   ```

### Pre-Production Testing

```bash
# Run against staging environment
k6 run \
  --env BASE_URL=https://staging.oriva.ai \
  --env APP_ID=hugo-matchmaker \
  smoke-test.js
```

### Production Testing

⚠️ **Warning**: Only run production load tests during scheduled maintenance windows or with proper coordination.

```bash
# Production load test (use with caution)
k6 run \
  --env BASE_URL=https://api.oriva.ai \
  --env APP_ID=hugo-matchmaker \
  --env TEST_RUN_ID=prod-$(date +%s) \
  --out json=results/prod-load-$(date +%s).json \
  chat-load-test.js
```

## Analyzing Results

### Real-time Dashboard

k6 provides a real-time CLI dashboard during test execution showing:
- Virtual users (VUs)
- Request rate
- Response times (min, avg, max, p95, p99)
- Error rate
- Custom metrics

### JSON Output

Export results to JSON for detailed analysis:

```bash
k6 run --out json=results.json chat-load-test.js

# Analyze with jq
cat results.json | jq 'select(.type=="Point" and .metric=="http_req_duration") | .data.value' | sort -n
```

### Cloud Results (k6 Cloud)

For advanced analysis and reporting, use k6 Cloud:

```bash
k6 login cloud --token YOUR_TOKEN
k6 cloud chat-load-test.js
```

## Performance SLOs

Based on `docs/SCALING.md`:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.9% | 30 days |
| Response Time (p95) | < 1000ms | 24 hours |
| Response Time (p99) | < 3000ms | 24 hours |
| Error Rate | < 1% | 24 hours |

## Troubleshooting

### High Error Rates

If error rate > 5%:
1. Check server logs for errors
2. Verify database connectivity
3. Check external API status (OpenAI, etc.)
4. Review recent deployments

### High Response Times

If p95 > 3000ms:
1. Check database connection pool utilization
2. Review slow query logs
3. Verify CDN cache hit rates
4. Check external API latency

### Rate Limiting

If seeing many 429 responses:
1. Review rate limit configuration in `api/middleware/userRateLimit.ts`
2. Adjust test to respect rate limits
3. Consider increasing rate limits for load testing

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run smoke test
        run: |
          k6 run \
            --env BASE_URL=${{ secrets.API_URL }} \
            --env APP_ID=hugo-matchmaker \
            tests/load/smoke-test.js

      - name: Run load test
        run: |
          k6 run \
            --env BASE_URL=${{ secrets.API_URL }} \
            --env APP_ID=hugo-matchmaker \
            --out json=results.json \
            tests/load/chat-load-test.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: results.json
```

## Best Practices

1. **Always run smoke tests before full load tests** to catch obvious issues early
2. **Monitor the system during load tests** using health endpoint and dashboards
3. **Coordinate production load tests** to avoid impacting real users
4. **Document test results** for capacity planning and trend analysis
5. **Set realistic thresholds** based on actual SLOs and business requirements
6. **Use unique test run IDs** for tracking and correlation with monitoring systems
7. **Clean up test data** after load testing completes

## Related Documentation

- [Scaling Runbook](../../docs/SCALING.md) - Infrastructure scaling procedures
- [Monitoring Guide](../../docs/MONITORING.md) - Observability and alerting
- [Performance SLOs](../../docs/SCALING.md#performance-slos) - Service level objectives