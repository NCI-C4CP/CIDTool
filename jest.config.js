export default {
  // Use jsdom environment to simulate browser APIs
  testEnvironment: 'jsdom',
  
  // Look for tests in the tests directory
  testMatch: ['**/tests/**/*.test.js'],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Transform ES modules
  transform: {},
  
  // Enable jest globals for ES modules
  injectGlobals: true,
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/login.js',
    '!src/events.js'
  ],
  
  // Coverage thresholds (optional - uncomment when ready)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50
  //   }
  // },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // Module name mapping for imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Verbose output
  verbose: true
};
