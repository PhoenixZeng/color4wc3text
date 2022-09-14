import * as vscode from 'vscode';


/// 颜色提供
const convertInt2Hex = (int: number) => {
  return Math.ceil(int * 255).toString(16).padStart(2, "0");
};
const color2CssColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let colorCodeString =  convertInt2Hex(r) + convertInt2Hex(g) + convertInt2Hex(b);
    return colorCodeString;
  }
  return "000000";
};
const color2JColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let colorCodeString = convertInt2Hex(a) + convertInt2Hex(r) + convertInt2Hex(g) + convertInt2Hex(b);
    return colorCodeString;
  }
  return "00000000";
};
const ceilToStr = (int: number,isHex?: boolean) => {
  if (isHex) {
    return '0x'+Math.ceil(int * 255).toString(16).padStart(2, "0");
  }
  return Math.ceil(int * 255).toString(10);
}

const color2ColorClassColorCode = (color: vscode.Color,flags?:boolean[]) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let colorCodeString:string
    if (flags) {
      colorCodeString = ceilToStr(r,flags[0])+", "+ceilToStr(g,flags[1])+", "+ceilToStr(b,flags[2])+", "+ceilToStr(a,flags[3]);
    }else{
      colorCodeString = ceilToStr(r)+", "+ceilToStr(g)+", "+ceilToStr(b)+", "+ceilToStr(a);
    }
    return colorCodeString;
  }
  return "0, 0, 0, 255";
};
const color2Color3ClassColorCode = (color: vscode.Color,flags?:boolean[]) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let colorCodeString:string
    if (flags) {
      colorCodeString = ceilToStr(r,flags[0])+", "+ceilToStr(g,flags[1])+", "+ceilToStr(b,flags[2]);
    }else{
      colorCodeString = ceilToStr(r)+", "+ceilToStr(g)+", "+ceilToStr(b);
    }
    return colorCodeString;
  }
  return "0, 0, 0";
};

const numberFormat = (str: string,base?: number) => {
  if (str.startsWith("0x") || str.startsWith("0X")) {
    return Number.parseInt(str)
  }
  if (base) {
    if (base == 16) {
      return Number.parseInt("0x" +str)
    }else{
      Number.parseInt(str)
    }
  }else{
    if (Number.parseInt(str).toString()==str) {
      return Number.parseInt(str)
    }
    if (str.match(new RegExp(/\[0-9a-fA-F]{2}/, "g"))) {
      return Number.parseInt("0x" +str)
    }
  }
  return Number.parseInt(str)
};

const getFuncName = (document: vscode.TextDocument, range: vscode.Range) => {
  let name = document.getText(range);
  return name.substring(0, name.indexOf('(')) 
}

class HexDocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/\|[cC][0-9a-fA-F]{8}/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let a = numberFormat( lineText.substring(posstion + 2, posstion + 2 + 2),16) / 255;
          let r = numberFormat( lineText.substring(posstion + 4, posstion + 4 + 2),16) / 255;
          let g = numberFormat( lineText.substring(posstion + 6, posstion + 6 + 2),16) / 255;
          let b = numberFormat( lineText.substring(posstion + 8, posstion + 8 + 2),16) / 255;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let document = context.document;
    let range = context.range;
    let documentText = document.getText(range);
    return [new vscode.ColorPresentation(`${
      documentText.substring(0, 2)
      }${
      color2JColorCode(new vscode.Color(r, g, b, a))
      }${
      documentText.substring(10)
      }`)];

  }
}


class CssDocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/#[\da-fA-F]{6}/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let a = 255 / 255;
          let r = numberFormat( lineText.substring(posstion + 1, posstion + 1 + 2),16) / 255;
          let g = numberFormat( lineText.substring(posstion + 3, posstion + 3 + 2),16) / 255;
          let b = numberFormat( lineText.substring(posstion + 5, posstion + 5 + 2),16) / 255;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    return [new vscode.ColorPresentation(`#${
      color2CssColorCode(new vscode.Color(r, g, b, a))
    }`)]
  }
}


class ColorDocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[cC]olor\( *\w+( *, *\w+ *){3}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\w+) *, *(\w+) *, *(\w+) *, *(\w+) */));
          if (nums) {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums[1]) / 255;
            let g = numberFormat(nums[2]) / 255;
            let b = numberFormat(nums[3]) / 255;
            let a = numberFormat(nums[4]) / 255;
            
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
            posstion += x.length;
          }
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let name = getFuncName(context.document, context.range);
    return [new vscode.ColorPresentation(name+`(${
        color2ColorClassColorCode(new vscode.Color(r, g, b, a))
      })`)];

  }
}

class Color3DocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[cC]olor\( *[0-9A-Fa-fxX]+( *, *[0-9A-Fa-fxX]+ *){2}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *([0-9A-Fa-fxX]+) *, *([0-9A-Fa-fxX]+) *, *([0-9A-Fa-fxX]+) */));
          if(nums)
          {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums[1]) / 255;
            let g = numberFormat(nums[2]) / 255;
            let b = numberFormat(nums[3]) / 255;
            let a = 1;
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
            posstion += x.length;
          }
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let name = getFuncName(context.document, context.range);
    return [new vscode.ColorPresentation(name + `(${
        color2Color3ClassColorCode(new vscode.Color(r, g, b, a))
      })`)];
  }
}

class RGBADocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[rR][gG][bB][aA]\( *\w+( *, *\w+ *){2} *, *\d*\.?\d* *\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\w+) *, *(\w+) *, *(\w+) *, *(\d*\.?\d*) */));
          if (nums) {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums[1]) / 255;
            let g = numberFormat(nums[2]) / 255;
            let b = numberFormat(nums[3]) / 255;
            let a = Number.parseFloat(nums[4]) ;
            
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
            posstion += x.length;
          }
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let name = getFuncName(context.document, context.range);
    return [new vscode.ColorPresentation(name+`(${
      color2Color3ClassColorCode(new vscode.Color(r, g, b, 1)) + ', ' + a.toFixed(2)
      })`)];

  }
}


class RGBDocumentColorProvider implements vscode.DocumentColorProvider {
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[rR][gG][bB]\( *\w+( *, *\w+ *){2}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\w+) *, *(\w+) *, *(\w+) */));
          if (nums) {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums[1]) / 255;
            let g = numberFormat(nums[2]) / 255;
            let b = numberFormat(nums[3]) / 255;
            
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, 1)));
            posstion += x.length;
          }
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let name = getFuncName(context.document, context.range);
    return [new vscode.ColorPresentation(name+`(${
      color2Color3ClassColorCode(new vscode.Color(r, g, b, 1))
      })`)];

  }
}

const hexSupportLanguages = ["jass","lua","ini","vjass","zinc","fdf","json",'js',"javascript","typescript"];
const colorSupportLanguages = ["jass","lua","vjass","zinc",'js',"javascript","typescript"];
const cssSupportLanguages = ["css","html","xml","json",'js',"javascript","typescript","lua","ini"];
const rgbaSupportLanguages = ["css","html",'js',"javascript","typescript"];

hexSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new HexDocumentColorProvider);
});
colorSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new ColorDocumentColorProvider);
  vscode.languages.registerColorProvider(language, new Color3DocumentColorProvider);
});
cssSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new CssDocumentColorProvider);
});
rgbaSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new RGBADocumentColorProvider);
  vscode.languages.registerColorProvider(language, new RGBDocumentColorProvider);
});
