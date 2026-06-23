# WS-A Budget Ledger Test Suite

Comprehensive test coverage for the Budget Ledger service covering write-path, read-path, governance hooks, and database operations.

## Test Statistics

- **Total Tests**: 155+ tests
- **Unit Tests**: 135+ (exceeds 40 minimum)
- **Integration Tests**: 20+ (exceeds 12 minimum)
- **Target Coverage**: >80% (lines, functions, branches)

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm test:coverage

# Watch mode for development
npm test:watch

# Run specific test file
npm test -- writeLedgerEntry.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="budget exhaustion"
```

## Test Organization

### Unit Tests

#### Write Path (`src/write/__tests__/writeLedgerEntry.test.ts`) - 28 tests
- **Successful Writes** (5 tests)
  - Valid payload execution
  - UUID generation for missing entryId
  - Metrics recording
  - Governance event emission
  - Custom governance configuration

- **Idempotency Handling** (2 tests)
  - Duplicate entry detection
  - No-retry on idempotency errors

- **Retry Logic with Exponential Backoff** (6 tests)
  - Transient database error retries
  - Default retry delays [100, 200, 400]ms
  - Custom retry delays
  - Custom maxRetries setting
  - Exhausting retry limits
  - Error propagation after retries

- **Validation** (10 tests)
  - Invalid agentId rejection
  - Negative tokensUsed rejection
  - Negative costUsd rejection
  - Token constraint violations (MAX_TOKENS = 1B)
  - Cost constraint violations (MAX_COST_USD = 999,999.99999)
  - Boundary value acceptance (max tokens)
  - Boundary value acceptance (max cost)

- **Latency Tracking** (2 tests)
  - Accurate latency measurement
  - Latency in response

- **Error Handling & Logging** (3 tests)
  - Unexpected database errors
  - Structured log output
  - Concurrent writes with different IDs

#### Read Path (`src/read/__tests__/readLedgerEntry.test.ts`) - 28 tests
- **readLatestEntry** (5 tests)
  - Retrieve most recent entry
  - Null response for non-existent entries
  - Metrics recording
  - Database error handling
  - SessionId filtering

- **readRollingWindow** (7 tests)
  - 60-second window aggregation
  - 300-second (5m) window aggregation
  - 1800-second (30m) window aggregation
  - Empty window handling
  - Metrics recording
  - Custom window sizes
  - SLO violation detection in windows

- **readCumulative** (6 tests)
  - Lifetime usage totals
  - Zero totals for new agents
  - Metrics recording
  - Projected cost calculation
  - Historical cost tracking

- **readByQuery** (8 tests)
  - Filter by agentId
  - Filter by sessionId
  - Date range filtering
  - Pagination support
  - Empty result handling
  - Metrics recording
  - Sorting capability
  - Complex multi-filter queries

- **Read Performance** (2 tests)
  - Latency measurement
  - Reads without session context

#### Governance Hooks (`src/governance/__tests__/hooks.test.ts`) - 25 tests
- **checkBudgetExhaustion** (5 tests)
  - Emit governance_abort on cost exhaustion
  - No event on available budget
  - Token budget checks
  - Token budget exhaustion
  - Missing config handling

- **checkThresholdWarnings** (6 tests)
  - Warning at 80% threshold
  - Caution at 70% threshold
  - No warning below threshold
  - Multiple threshold warnings
  - Custom threshold percentages
  - Threshold breach detection

- **checkSloViolation** (6 tests)
  - 1-minute burn rate violation (>14x)
  - 5-minute burn rate violation (>6x)
  - 30-minute burn rate violation (>3x)
  - Normal burn rates (no warning)
  - Missing metrics handling
  - Multiple SLO violations simultaneously

- **registerGovernanceHook** (3 tests)
  - Hook registration
  - Duplicate hook rejection
  - Hook unregistration

- **checkGovernanceState** (5 tests)
  - Full orchestration of checks
  - Abort status on budget exhaustion
  - Warning status on thresholds
  - Event aggregation
  - Success status on all passes
  - Missing config handling
  - Hook error handling

#### Governance Events (`src/governance/__tests__/governanceEvents.test.ts`) - 31 tests
- **Event Emission & Subscription** (4 tests)
  - governance_warning emission
  - governance_abort emission
  - Multiple listener invocation
  - Same-event-type multiple listeners

- **Listener Management** (4 tests)
  - Unsubscribe with returned function
  - Unsubscribe with offGovernanceEvent
  - Re-subscription after unsubscribe
  - Non-existent listener unsubscribe

- **Event Data Integrity** (4 tests)
  - Metadata preservation
  - Timestamp inclusion
  - AgentId/SessionId inclusion
  - Unique eventId generation

- **Listener Invocation Guarantees** (3 tests)
  - Synchronous invocation
  - Error handling doesn't block other listeners
  - Listener behavior based on event properties

- **Event Propagation** (3 tests)
  - SLO Controller notification
  - Adapter Cache notification
  - External system chaining

- **Error Handling** (2 tests)
  - Listener callback error handling
  - Event data preservation on errors

- **Listener Cleanup** (2 tests)
  - Clear all listeners
  - Per-type listener clearing

#### Database Client (`src/db/__tests__/client.test.ts`) - 23 tests
- **Pool Initialization** (3 tests)
  - Pool creation
  - Environment variable configuration
  - Connection pool limits

- **Transaction Execution** (5 tests)
  - Function execution within transaction
  - BEGIN on transaction start
  - COMMIT on success
  - ROLLBACK on error
  - Connection release

- **Error Handling** (3 tests)
  - Connection error handling
  - Rollback error handling
  - Function error propagation

- **Transaction Isolation** (4 tests)
  - Concurrent transactions
  - Custom isolation levels
  - Serialization error handling
  - Concurrent modification detection

- **Pool Management** (4 tests)
  - Connection pool reuse
  - Pool closure
  - Pool exhaustion handling
  - Health check implementation

- **Prepared Statements** (2 tests)
  - Parameterized query safety
  - Large result set efficiency

- **Connection Pooling** (2 tests)
  - Connection reuse
  - Idle timeout configuration

### Integration Tests (`src/__tests__/integration.test.ts`) - 20+ tests

- **Write-Read-Governance Flow** (4 tests)
  - Write and immediate retrieval
  - Cumulative cost tracking across writes
  - Governance checks after write
  - Governance event emission on thresholds

- **Rolling Window Aggregation** (3 tests)
  - 1-minute window aggregation
  - 5-minute window with SLO detection
  - 30-minute window for extended analysis

- **Budget Exhaustion Lifecycle** (2 tests)
  - Progression: normal → warning → abort
  - Cascading events for exhaustion

- **Concurrent Operations** (2 tests)
  - Concurrent writes to same session
  - Consistency across concurrent reads/writes

- **Idempotency & Duplicate Handling** (2 tests)
  - Duplicate write detection
  - Cumulative tracking despite duplicates

- **Query Flexibility** (2 tests)
  - Multi-criteria filtering
  - Pagination across large result sets

- **Error Recovery & Resilience** (3 tests)
  - Transient error retry
  - Governance check failure handling
  - Data consistency on partial failures

## Coverage Goals

| Component | Unit Tests | Integration Tests | Target Coverage |
|-----------|-----------|------------------|-----------------|
| Write Path | 28 | 4 | 85%+ |
| Read Path | 28 | 6 | 85%+ |
| Governance Hooks | 25 | 8 | 85%+ |
| Governance Events | 31 | 2 | 90%+ |
| Database Client | 23 | - | 80%+ |
| **Total** | **135+** | **20+** | **>80%** |

## Test Patterns

### Mocking Strategy
- Database operations mocked at `db/client.ts` level
- External services (metrics, logging) mocked
- Fixtures provide consistent test data

### Test Data
Helper functions in `src/__tests__/helpers.ts`:
- `createMockPayload()` - LedgerWritePayload with sensible defaults
- `createMockEntry()` - LedgerEntry with window metrics
- `createMockGovernanceEvent()` - GovernanceEvent for events testing
- `mockDbClient()` / `mockPoolClient()` - Mocked database clients

### Error Testing
Each module tests:
- Happy path (success scenarios)
- Error scenarios (validation, database errors)
- Boundary conditions (max/min values)
- Edge cases (empty results, null values)

### Performance Testing
- Latency measurements for read/write operations
- Concurrent operation handling
- Large dataset processing (10k+ entries)

## CI/CD Integration

Tests run in GitHub Actions on:
- Push to any branch
- Pull requests
- Nightly validation

Coverage reports available in PR checks.

## Development Workflow

1. **Write tests first** (TDD approach recommended)
2. **Run tests during development**
   ```bash
   npm test:watch
   ```
3. **Check coverage**
   ```bash
   npm test:coverage
   ```
4. **Commit with test results**
   - All tests must pass
   - Coverage must meet thresholds

## Troubleshooting

### Tests Timeout
- Default timeout: 10 seconds (configurable in jest.config.js)
- Increase for slow database operations:
  ```typescript
  jest.setTimeout(30000);
  ```

### Mock Issues
- Clear mocks between tests: `jest.clearAllMocks()`
- Reset modules: `jest.resetModules()`
- Check setup.ts for global mock configuration

### Coverage Gaps
- Run with coverage: `npm test:coverage`
- Check `coverage/lcov-report/index.html` for detailed coverage
- Update jest.config.js coverage thresholds as needed

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Test names describe what's being tested and expected outcome
3. **Fixtures**: Use helper functions for test data
4. **Assertions**: Use specific matchers (toEqual, toHaveBeenCalledWith, etc.)
5. **Performance**: Mock I/O operations
6. **Maintenance**: Update tests when code changes

## References

- [Jest Documentation](https://jestjs.io/)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Test Doubles (Mocks, Stubs, Fakes)](https://martinfowler.com/articles/mocksArentStubs.html)
