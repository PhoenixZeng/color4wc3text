# Change Log

All notable changes to the "color4wc3text" extension will be documented in this file.

Check [Keep a Changelog](https://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0重构]

### Added (新增)
- **CSS HEX 支持扩展**：现在支持 `#RGB`、`#RGBA`、`#RRGGBB`、`#RRGGBBAA` 四种格式。
- **自动化测试体系**：引入 `@vscode/test-cli` 与 Mocha，编写了 13 个核心用例覆盖颜色匹配、解析与回写逻辑。

### Changed (变更)
- **HEX 输出格式统一**：War3 与 CSS 的 HEX 回写时，现在会统一输出标准的大写格式。
- **颜色解析逻辑收紧**：`color()` 函数现在严格要求输入纯十进制数字或带 `0x` 前缀的十六进制，移除了以往包含字母就当作十六进制的歧义解析。
- **Provider 注册范围优化**：移除了对 `html` 和 `css` 的自定义颜色识别，避免与 VS Code 原生功能冲突。

### Fixed (修复)
- **后缀保留问题**：修复了修改 War3 颜色时，硬编码截取可能误吞 `|r` 等后缀文本的隐患。
- **数值溢出问题**：修复了浮点数在边界情况（如 `0.001`）下使用 `Math.ceil` 转换导致 HEX 超限溢出的问题。
- **位置偏移问题**：修复了同一行出现多个相同颜色文本时，使用 `indexOf` 定位可能导致匹配位置不准确的问题。
- **取消响应机制**：优化了超大文件扫描时的中断逻辑，现在取消扫描能更快停止并释放资源。

## [0.1.16]

- 修复了打开超大文件时,可能发生卡死的情况

## [0.1.14]

- 现在修改Color和RGBA不会影响大小写了

## [0.1.10]

- 支持了rgba和rgb

## [0.1.9]

- Color现在支持十六进制表述
- 修复js和ts支持
- 修复一直为黑色的bug

## [0.1.7]

- Color支持大写
- 对js和ts提供支持

## [0.1.1]

- color支持三个参数的场景

## [0.1.0]

- 修复color逗号的错误 添加css语法识别

## [0.0.10]

- 修复BUG并且更新依赖

## [0.0.8]

- 添加了fdf和json格式

## [0.0.7]

- 尝试修复可能和其他插件冲突的问题

## [0.0.6]

- 没啥变化 瞎鸡儿更新
