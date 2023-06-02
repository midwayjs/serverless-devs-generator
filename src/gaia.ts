import { Document, stringify } from 'yaml';
import { BaseGenerator } from './common/base';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FunctionInformation } from './interface';
export class GaiaGenerator extends BaseGenerator<any> {
  analyzeFunction(result: FunctionInformation): unknown[] {
    return [];
  }

  fillYaml(document: Document.Parsed<any, true>, result: unknown[]) {
    writeFileSync(
      join(this.options.appDir, 'spec.yml'),
      stringify(document, { indent: 2 })
    );
    return undefined;
  }

  static canSupport(options) {
    const filePath = join(options.appDir, 'f.yml');
    if (existsSync(filePath)) {
      const file = readFileSync(filePath, 'utf8');
      if (/@ali\/midway-gaia-starter/.test(file)) {
        return [filePath, file];
      }
      return false;
    }
  }

  async generateEntry(information: FunctionInformation, config: any[]) {
    const tpl = `const { join } = require('path');
const { BootstrapStarter } = require('@ali/midway-gaia-starter');
const starter = new BootstrapStarter();

module.exports = starter.start({
  appDir: __dirname,
  baseDir: join(__dirname, 'dist'),
  initializeMethodName: 'initializer',
});
`;

    for (const funcInfo of information.functionList) {
      // 根据 handler 生成统一的入口文件
      const handler = funcInfo.funcHandlerName;
      const filePrefix = handler.split('.')[0];
      const file = join(this.options.appDir, `${filePrefix}.js`);
      if (!existsSync(file)) {
        writeFileSync(join(this.options.appDir, `${filePrefix}.js`), tpl);
      }
    }
  }
}
