import { defineConfig } from '@vscode/test-cli';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { existsSync, realpathSync, readdirSync } from 'node:fs';

// 只有显式指定版本时才下载；默认复用 PATH 中的本机 VS Code。
const version = process.env.VSCODE_TEST_VERSION;
let installation;
if (!version) {
  let executable = process.env.VSCODE_EXECUTABLE_PATH;
  if (!executable) {
    const command = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['code'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    const bin = dirname(realpathSync(command));
    executable = resolve(bin, process.platform === 'win32' ? '../Code.exe' : process.platform === 'darwin' ? '../../../MacOS/Electron' : '../code');
  }
  if (!existsSync(executable)) {
    throw new Error('未找到本机 VS Code，请将 VSCODE_EXECUTABLE_PATH 设置为 VS Code 可执行文件的完整路径。');
  }
  installation = { fromPath: executable };
}

export default defineConfig({
  // 按源文件生成列表，避免运行旧编译产物中的已删除测试。
  files: readdirSync(new URL('./src/test/', import.meta.url), { recursive: true })
    .filter(file => file.endsWith('.test.ts'))
    .map(file => `out/test/${file.replaceAll('\\', '/').replace(/\.ts$/, '.js')}`),
  ...(version ? { version } : { useInstallation: installation }),
  mocha: { ui: 'tdd', timeout: 20000 },
});
