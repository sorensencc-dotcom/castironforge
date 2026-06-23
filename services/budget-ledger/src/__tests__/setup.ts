// Test setup
jest.mock('../db/client');
jest.mock('../governance/governanceEvents');
jest.mock('../metrics/ledgerMetrics');
jest.mock('../utils/logging');

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console.log = jest.fn();
  global.console.warn = jest.fn();
  global.console.error = jest.fn();
}

// Mock timers setup for tests that need it
beforeEach(() => {
  jest.clearAllMocks();
});
