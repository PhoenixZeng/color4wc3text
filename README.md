# ColorPicker

这是一个 VS Code 拓展。

它使得魔兽争霸3的字符串前缀可以被颜色选择器识别和修改，后续也支持了一些常规的格式。

## 环境要求

- VS Code 1.137.0 或更高版本。
- 开发环境使用 Node.js 22.12.0 或更高版本。

## 开发验证

运行 `npm ci` 安装锁定的依赖，使用 `npm test` 执行编译、lint 和 VS Code 扩展测试，使用 `npm audit` 检查依赖安全。

`package.json` 中的 `overrides` 将测试工具链的 Mocha、glob、minimatch 固定在已修复安全问题的主版本范围；待上游测试工具支持这些版本后可移除相应覆盖。请保留并同步提交 `package-lock.json`。

## 支持以下语法

```txt
War3 语法
     - |cAARRGGBB (支持 |c 和 |C，修改后自动统一大写，并完美保留 |r 后缀)
     
color 函数 (支持 3 个或 4 个参数)
     - color(255, 0, 0)
     - color(255, 0, 0, 255)
     - 支持十六进制写法 color(0xFF, 0x00, 0x00)
     - 大写开头 Color 也可识别

rgb / rgba 函数
     - rgb(255, 0, 0)
     - rgba(255, 0, 0, 0.5)
     - 大写开头也可识别

CSS HEX 颜色
     - #FFF
     - #FFFF (带透明度)
     - #FFFFFF
     - #FFFFFFFF (带透明度)
```

## 目前支持以下后缀格式的文件

> 注：`css` 和 `html` 文件由 VS Code 原生自带颜色识别功能，本插件不再重复注册。

| 格式 | war3语法 | color函数 | rgb/rgba函数 | css HEX |
| :--- | :--- | :--- | :--- | :--- |
| jass | 支持 | 支持 | - | - |
| vjass | 支持 | 支持 | - | - |
| zinc | 支持 | 支持 | - | - |
| lua | 支持 | 支持 | - | 支持 |
| ini | 支持 | - | - | 支持 |
| fdf | 支持 | - | - | - |
| json | 支持 | - | - | 支持 |
| js | 支持 | 支持 | 支持 | 支持 |
| ts | 支持 | 支持 | 支持 | 支持 |
| xml | - | - | - | 支持 |

---
**交流群:**
旧群被封 新群: 魔兽争霸3 lua作图交流群: 1019770872
