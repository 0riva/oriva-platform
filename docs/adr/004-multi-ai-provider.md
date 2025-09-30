# ADR-004: Multi-Provider AI Strategy

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: Hugo Platform Integration (T001-T062)

## Context

The Oriva Platform (specifically Hugo Matchmaker) requires AI capabilities for:
- Conversational chat coaching
- Personality-aware responses
- Knowledge base integration
- Natural language understanding

**Considerations**:
- Primary provider could experience outages
- Rate limits vary by provider
- Cost optimization opportunities
- Model capabilities differ
- Future flexibility needed

**Single-Provider Risks**:
- Service disruption affects all users
- Rate limit exhaustion blocks all requests
- Locked into single vendor's pricing
- Limited to one model's capabilities

## Decision

We will implement a **multi-provider AI strategy** with OpenAI as primary and Anthropic as secondary:

### Provider Configuration

**Primary: OpenAI (GPT-4)**
- Model: `gpt-4-turbo-preview`
- Use case: All chat requests by default
- Strengths: Fast response, good instruction following
- Rate limits: Higher tier available

**Secondary: Anthropic (Claude)**
- Model: `claude-3-sonnet-20240229`
- Use case: Fallback when OpenAI unavailable
- Strengths: Longer context, nuanced responses
- Rate limits: Separate quota from OpenAI

### Fallback Strategy

```typescript
async function generateResponse(messages, config) {
  try {
    // Try OpenAI first
    return await openai.chat(messages, config);
  } catch (error) {
    if (isRateLimitOrUnavailable(error)) {
      // Fallback to Anthropic
      console.warn('OpenAI unavailable, using Anthropic fallback');
      return await anthropic.messages(messages, config);
    }
    throw error;
  }
}
```

### Provider Selection Logic

1. **Default**: OpenAI GPT-4 for all requests
2. **Automatic fallback**: Anthropic Claude if OpenAI fails
3. **Manual override**: Future support for user/app preferences
4. **Load balancing**: Future feature if needed

## Consequences

### Positive

✅ **High Availability**
- Service continues if primary provider down
- Reduces single point of failure
- Better uptime SLA (99.9%+)

✅ **Rate Limit Resilience**
- Secondary provider has separate quota
- Can handle traffic spikes
- Reduces 429 errors to users

✅ **Cost Optimization Potential**
- Can route cheaper queries to cheaper models
- Future: Dynamic routing based on cost/performance
- Flexibility to negotiate better rates

✅ **Quality Options**
- Different models for different use cases
- Can leverage strengths of each provider
- Future: A/B testing between models

✅ **Vendor Flexibility**
- Not locked into single provider's pricing
- Easier to switch if better option emerges
- Negotiating leverage with providers

### Negative

⚠️ **Implementation Complexity**
- Requires abstraction layer for providers
- Error handling for multiple services
- Testing across providers
- Mitigated by: Clean abstraction, shared interface

⚠️ **Cost Overhead**
- Must maintain API keys for both
- Potential unused quota on secondary
- Mitigated by: Fallback-only usage minimizes waste

⚠️ **Response Consistency**
- Different models may give different responses
- User experience variation during fallback
- Mitigated by: Consistent system prompts, similar models

⚠️ **Operational Overhead**
- Monitor two providers
- Maintain two sets of credentials
- Track usage/costs separately
- Mitigated by: Centralized monitoring, unified metrics

### Trade-offs Accepted

1. **Slight complexity increase** for reliability benefits
2. **Response variation during fallback** for availability
3. **Dual provider costs** for rate limit resilience

## Implementation Notes

### Provider Abstraction Layer

```typescript
// api/lib/ai/provider.ts
interface AIProvider {
  chat(messages: Message[], config: ChatConfig): Promise<ChatResponse>;
  isAvailable(): Promise<boolean>;
}

class OpenAIProvider implements AIProvider {
  async chat(messages, config) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      ...config,
    });
    return normalizeResponse(response);
  }
}

class AnthropicProvider implements AIProvider {
  async chat(messages, config) {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      messages: convertToAnthropicFormat(messages),
      ...config,
    });
    return normalizeResponse(response);
  }
}
```

### Fallback Configuration

```typescript
const AI_CONFIG = {
  primary: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    timeout: 25000,  // 25s
  },
  secondary: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    timeout: 25000,
  },
  fallbackOnErrors: ['rate_limit', 'unavailable', 'timeout'],
};
```

### Monitoring

Track provider usage and performance:
- Requests per provider
- Fallback rate
- Response times by provider
- Cost per provider
- Error rates by provider

Metrics exposed via `/api/health`:
```json
{
  "ai_providers": {
    "openai": {
      "requests": 1543,
      "errors": 2,
      "avg_latency_ms": 1234
    },
    "anthropic": {
      "requests": 15,
      "errors": 0,
      "avg_latency_ms": 1456
    }
  }
}
```

## Provider Comparison

| Feature | OpenAI GPT-4 | Anthropic Claude 3 |
|---------|--------------|-------------------|
| Context window | 128K tokens | 200K tokens |
| Response speed | Fast (~1-2s) | Fast (~1-2s) |
| Instruction following | Excellent | Excellent |
| Cost (input) | $10/1M tokens | $3/1M tokens |
| Cost (output) | $30/1M tokens | $15/1M tokens |
| Rate limits | High (tier-based) | Medium |
| Availability | 99.9% | 99.9% |

## Scaling Strategy

**Current (Launch)**:
- OpenAI: Primary for all requests
- Anthropic: Fallback only (expect <5% usage)

**Future (High Volume)**:
- Intelligent routing based on query complexity
- Load balancing between providers
- Cost-based routing for simple queries
- User/app preference support

## Cost Analysis

**Assumptions**:
- 1000 requests/day
- 500 tokens avg input, 200 tokens avg output
- 95% OpenAI, 5% Anthropic (fallback)

**Monthly Cost**:
```
OpenAI:
  - Input: 950 req × 30 days × 500 tokens × $10/1M = $142.50
  - Output: 950 req × 30 days × 200 tokens × $30/1M = $171.00
  - Subtotal: $313.50

Anthropic (fallback):
  - Input: 50 req × 30 days × 500 tokens × $3/1M = $2.25
  - Output: 50 req × 30 days × 200 tokens × $15/1M = $4.50
  - Subtotal: $6.75

Total: ~$320/month (1000 req/day)
```

## Alternatives Considered

### 1. OpenAI Only

**Pros**:
- Simplest implementation
- Single provider to monitor
- No abstraction layer needed

**Cons**:
- Single point of failure
- Rate limit risk
- No fallback during outages

**Rejected**: Availability risk too high

### 2. Multiple Models from Single Provider

**Approach**: Use GPT-4 and GPT-3.5 from OpenAI

**Pros**:
- Single API integration
- No provider abstraction needed
- Simpler error handling

**Cons**:
- Doesn't solve rate limit issue
- Still single point of failure
- Quality difference more noticeable

**Rejected**: Doesn't address availability

### 3. Three or More Providers

**Approach**: Add Google (Gemini), Cohere, etc.

**Pros**:
- Maximum redundancy
- More routing options

**Cons**:
- Significantly more complex
- Higher operational overhead
- Integration and testing burden
- Marginal benefit over two

**Rejected**: Complexity not justified

### 4. Self-Hosted LLM

**Approach**: Host open-source models (Llama, Mistral)

**Pros**:
- No rate limits
- No API costs
- Full control

**Cons**:
- Infrastructure complexity
- Model quality gap vs. GPT-4/Claude
- GPU costs
- Maintenance overhead

**Rejected**: Quality and operational overhead

## Error Scenarios

### Scenario 1: OpenAI Rate Limit

**Trigger**: 429 from OpenAI
**Action**: Immediately fallback to Anthropic
**User impact**: Slight delay, response quality maintained
**Recovery**: Automatic when rate limit window resets

### Scenario 2: OpenAI Outage

**Trigger**: 503 or timeout from OpenAI
**Action**: Fallback to Anthropic after 5s timeout
**User impact**: 5s delay on first attempt, then normal
**Recovery**: Health check every 60s, auto-restore

### Scenario 3: Both Providers Down

**Trigger**: Errors from both providers
**Action**: Return graceful error message
**User impact**: Chat unavailable
**Recovery**: Manual investigation, status page update

## Monitoring & Alerts

**Metrics to Track**:
- Primary provider success rate
- Fallback rate (should be <5%)
- Response time by provider
- Cost per provider
- Error rates

**Alert Thresholds**:
- Fallback rate >10% for 5 minutes: Warning
- Fallback rate >25% for 5 minutes: Critical
- Both providers error rate >50%: Page on-call

## Review Schedule

- **Monthly**: Review fallback rate and costs
- **Quarterly**: Evaluate model performance and pricing
- **Annually**: Comprehensive provider assessment

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [MONITORING.md](../MONITORING.md) - AI provider monitoring
- Hugo Platform Integration Spec - AI integration requirements