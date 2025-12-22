export default {
  default: {
    paths: ['tests/features/**/*.feature'],
    import: ['tests/step-definitions/**/*.js', 'tests/support/**/*.js'],
    format: ['progress-bar', 'html:tests/reports/cucumber-report.html'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
    parallel: 2,
    timeout: 30000,
  },
  critical: {
    paths: ['tests/features/**/*.feature'],
    import: ['tests/step-definitions/**/*.js', 'tests/support/**/*.js'],
    tags: '@critical',
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
    timeout: 20000,
  },
  smoke: {
    paths: ['tests/features/**/*.feature'],
    import: ['tests/step-definitions/**/*.js', 'tests/support/**/*.js'],
    tags: '@smoke',
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
    timeout: 15000,
  },
};
