export default {
  default: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step-definitions/**/*.js', 'tests/support/**/*.js'],
    format: ['progress-bar', 'html:tests/reports/cucumber-report.html'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
  },
};
