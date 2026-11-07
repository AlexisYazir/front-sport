const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'out-tsc/**', 'node_modules/**', '.angular/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
  },
  { files: ['src/**/*.html'], extends: [...angular.configs.templateRecommended] },
  {
    files: ['src/app/features/dashboard/admin/admin-pages/reviews/reviews.html'],
    extends: [...angular.configs.templateAccessibility],
  },
);
