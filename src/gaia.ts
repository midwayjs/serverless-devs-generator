import { stringify } from 'yaml';
import { BaseGenerator } from './common/base';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FunctionInformation } from './interface';

type FunctionConfig = {
  [handlerName: string]: {
    triggers?: {
      [triggerName: string]: any;
    };
  };
};

export class GaiaGenerator extends BaseGenerator<FunctionConfig> {
  analyzeFunction(result: FunctionInformation) {
    // 设置一个目标 yml
    this.options.targetYamlPath = 'spec.yml';

    const allFunc: {
      [functionName: string]: FunctionConfig;
    } = {};
    for (const func of result.functionList) {
      const handler = func.funcHandlerName;
      if (!handler || func.functionName?.includes('undefined')) {
        continue;
      }

      if (!allFunc[handler]) {
        allFunc[handler] = {
          triggers: {},
        };
      }

      if (!allFunc[handler]?.triggers) {
        allFunc[handler].triggers = {};
      }

      const newTriggerConfig = {};
      const triggerType = func.functionTriggerName;
      for (const key in func.functionTriggerMetadata) {
        if (!['functionName', 'handlerName', 'middleware'].includes(key)) {
          newTriggerConfig[key] = func.functionTriggerMetadata[key];
        }
      }

      allFunc[handler].triggers[triggerType] = newTriggerConfig;
    }
    return allFunc;
  }

  fillYaml(result: FunctionConfig) {
    // 分析出每个函数的触发器
    for (const handler in result) {
      const cloned = this.document.clone();
      for (const trigger in result[handler].triggers) {
        cloned.setIn([`trigger-${trigger}`], result[handler].triggers[trigger]);
      }

      writeFileSync(
        join(this.options.appDir, `spec.${handler}.yml`),
        stringify(cloned, { indent: 2 })
      );
    }

    return stringify(this.document, { indent: 2 });
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

  async generateEntry(
    information: FunctionInformation,
    result: FunctionConfig[]
  ) {
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
