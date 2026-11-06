import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  mocha: {
    ui: 'tdd',        // 必须：默认是 bdd，只有 describe/it
    timeout: 20000,
  },
});
