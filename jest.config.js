module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '**/__tests__/models/**/*.js',
        '**/__tests__/routes/**/*.js',
        '**/__tests__/utils/**/*.js'
      ],
      collectCoverageFrom: [
        'models/**/*.js',
        'routes/**/*.js',
        'utils/**/*.js',
        '!**/*.test.js',
        '!**/node_modules/**'
      ],
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '/scripts/'
      ],
      coverageThreshold: {
        global: {
          branches: 30,
          functions: 30,
          lines: 30,
          statements: 30
        }
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    },
    {
      displayName: 'browser',
      preset: 'jest-puppeteer',
      testMatch: ['**/__tests__/browser/**/*.test.js'],
      testTimeout: 30000,
      maxWorkers: 1,
    }
  ],
  verbose: true,
};
