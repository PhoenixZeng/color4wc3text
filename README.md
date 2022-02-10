# ColorPicker

这是一个vscode拓展

使得魔兽争霸3的字符串前缀可以被颜色选择器识别和修改
后续也支持了一些常规的格式可以被颜色选择器识别和修改

支持以下语法

``` txt
    war3
         - |cffffffff
    color
         - color(255,255,255)
         - color(255,255,255,255)
         大写开头`Color`也可识别
    rgba
         - rgb(255,255,255)
         - rgba(255,255,255,0.5)
         大写也可以识别 但是选择颜色后变为小写
    css
         - #ffffff
```

目前支持以下后缀格式的文件

    war3
        - jass
        - lua
        - ini
        - vjass
        - zinc
        - fdf
        - json
        - js
        - ts

    color
        - lua
        - vjass
        - zinc
        - js
        - ts
    rgba
        - html
        - css
        - js
        - ts
    css
        - html
        - css
        - xml
        - json
        - js
        - ts
        - lua
        - ini

旧群被封 新群:
魔兽争霸3 lua作图交流群:1019770872
