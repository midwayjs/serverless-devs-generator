import { Document, stringify, YAMLMap } from 'yaml';
import { BaseGenerator } from './common/base';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FunctionInformation } from './interface';
import * as micromatch from 'micromatch';

type FunctionConfig = {
  function: {
    name?: string;
    handler?: string;
  };
  handler?: string;
  events?: Array<{
    [type: 'http' | 'timer' | 'hsf' | 'mtop' | 'mq' | string]: any;
  }>;
};

function commonPrefixUtil(str1: string, str2: string): string {
  let result = '';
  const n1 = str1.length;
  const n2 = str2.length;

  for (let i = 0, j = 0; i <= n1 - 1 && j <= n2 - 1; i++, j++) {
    if (str1[i] !== str2[j]) {
      break;
    }
    result += str1[i];
  }
  return result;
}

export function commonPrefix(arr: string[]): string {
  let prefix: string = (arr && arr[0]) || '';
  const n = (arr && arr.length) || 0;
  for (let i = 1; i <= n - 1; i++) {
    prefix = commonPrefixUtil(prefix, arr[i]);
  }
  if (!prefix || prefix === '/') {
    return '';
  }
  const result = prefix.replace(/\/[^/]*$/gi, '') || '/';
  if (result && !/^\//.test(result)) {
    return '/' + result;
  }
  if (result === '/') {
    return '';
  }
  return result;
}

export class AliFCGenerator extends BaseGenerator<FunctionConfig> {
  analyzeFunction(result: FunctionInformation) {
    const allFunc: {
      [functionName: string]: FunctionConfig;
    } = {};
    if (Array.isArray(result.functionList)) {
      for (const func of result.functionList) {
        if (!func.functionTriggerName) {
          if (func.fullUrl && func.requestMethod && func.funcHandlerName) {
            func.functionTriggerName = 'http';
            func.functionTriggerMetadata = {
              method: func.requestMethod,
              path: func.fullUrl,
            };
          } else {
            continue;
          }
        }
        const handler = func.funcHandlerName;
        if (!handler || func.functionName?.includes('undefined')) {
          continue;
        }

        if (!func.functionTriggerMetadata) {
          func.functionTriggerMetadata = {};
        }

        const funcName =
          func.functionMetadata?.functionName ||
          func.functionTriggerMetadata?.functionName ||
          func.functionName ||
          handler.replace(/[^\w]/g, '-');

        if (!allFunc[funcName]) {
          allFunc[funcName] = {
            function: {
              name: funcName,
              handler,
            },
            events: [],
          };
        }

        if (!allFunc[funcName]?.events) {
          allFunc[funcName].events = [];
        }

        if (!allFunc[funcName]?.function.handler) {
          allFunc[funcName].function.handler = handler;
        }

        delete func.functionTriggerMetadata.functionName;
        delete func.functionTriggerMetadata.middleware;

        const triggerType = func.functionTriggerName;

        if (triggerType === 'http') {
          // 对 http 方法 any 的支持
          const { method } = func.functionTriggerMetadata;
          let methodList = [].concat(method || []);
          if (methodList.includes('any') || methodList.includes('all')) {
            func.functionTriggerMetadata.method = 'any';
            methodList = ['get', 'post', 'put', 'delete', 'head'];
          }
        }

        const newTriggerConfig = {};
        for (const key in func.functionTriggerMetadata) {
          if (!['functionName', 'handlerName', 'middleware'].includes(key)) {
            newTriggerConfig[key] = func.functionTriggerMetadata[key];
          }
        }

        const obj = {};
        if (triggerType === 'http') {
          obj[triggerType] = newTriggerConfig;
        } else {
          obj[triggerType] = true;
        }
        allFunc[funcName].events.push(obj);
      }
    }

    return this.processAggr(Object.values(allFunc));
  }

  processAggr(result: FunctionConfig[]) {
    // use picomatch to match url
    const allAggregationPaths = [];
    const aggregationInformation =
      (this.document.get('aggregation') as YAMLMap).toJSON() || {};

    let allFuncNames = result.map(func => func.function.name);

    for (const aggregationName in aggregationInformation) {
      const aggregationConfig = aggregationInformation[aggregationName];
      const aggregationFuncName = this.getAggregationFunName(aggregationName);

      const aggregationFunc = {
        function: {
          name: aggregationFuncName,
          handler: `${aggregationFuncName}.handler`,
        },
        _isAggregation: true,
        events: [],
      } as any;

      // 忽略原始方法，不再单独进行部署
      const deployOrigin = aggregationConfig.deployOrigin;

      let handlers = [];
      const allAggredHttpTriggers = [];
      const allAggredEventTriggers = [];
      if (aggregationConfig.functions || aggregationConfig.functionsPattern) {
        const matchedFuncName = [];
        const notMatchedFuncName = [];
        for (const functionName of allFuncNames) {
          const func = result.find(func => func.function.name === functionName);
          const isHttpFunction = func.events?.find(event => {
            return Object.keys(event)[0] === 'http';
          });
          // http 函数并且开启了 eventTrigger，需要忽略
          // 非 http 函数，并且没有开启  eventTrigger，需要忽略
          let isMatch = false;
          if (
            (isHttpFunction && aggregationConfig.eventTrigger) ||
            (!isHttpFunction && !aggregationConfig.eventTrigger)
          ) {
            isMatch = false;
          } else if (aggregationConfig.functions) {
            isMatch =
              aggregationConfig.functions.indexOf(func.function.name) !== -1;
          } else if (aggregationConfig.functionsPattern) {
            isMatch = micromatch.all(
              func.function.name,
              aggregationConfig.functionsPattern
            );
          }
          if (isMatch) {
            matchedFuncName.push(func.function.name);
          } else {
            notMatchedFuncName.push(func.function.name);
          }
        }
        allFuncNames = notMatchedFuncName;
        matchedFuncName.forEach((functionName: string) => {
          const func = result.find(func => func.function.name === functionName);
          if (!func || !func.events) {
            return;
          }

          for (const event of func.events) {
            const eventType = Object.keys(event)[0];
            const handlerInfo: any = {
              ...func,
              functionName,
              eventType,
            };
            if (eventType === 'http') {
              const httpInfo = {
                path: event.http.path,
                method: event.http.method,
              };
              allAggredHttpTriggers.push(httpInfo);
              Object.assign(handlerInfo, httpInfo);
            } else if (aggregationConfig.eventTrigger) {
              // 事件触发器支持
              const existsEventTrigger = handlers.find(
                handlerInfo => handlerInfo.eventType === eventType
              );
              if (!existsEventTrigger) {
                allAggredEventTriggers.push(event);
              }
            } else {
              continue;
            }
            if (!deployOrigin) {
              // 不把原有的函数进行部署
              console.log(
                ` - using function '${aggregationName}' to deploy '${functionName}'`
              );

              // remove function from result
              const index = result.findIndex(
                func => func.function.name === functionName
              );
              if (index !== -1) {
                result.splice(index, 1);
              }
            }

            handlers.push(handlerInfo);
          }
        });
      }
      handlers = handlers.filter((func: any) => !!func);

      aggregationFunc._handlers = handlers;
      aggregationFunc._allAggred = allAggredHttpTriggers;
      aggregationFunc.events = allAggredEventTriggers;

      if (allAggredHttpTriggers?.length) {
        const allPaths = allAggredHttpTriggers.map(aggre => aggre.path);
        let currentPath = commonPrefix(allPaths);
        currentPath =
          currentPath && currentPath !== '/' ? `${currentPath}/*` : '/*';

        console.log(
          ` - using path '${currentPath}' to deploy '${allPaths.join("', '")}'`
        );
        // path parameter
        if (currentPath.includes(':')) {
          const newCurrentPath = currentPath.replace(/\/:.*$/, '/*');
          console.log(
            ` - using path '${newCurrentPath}' to deploy '${currentPath}' (for path parameter)`
          );
          currentPath = newCurrentPath;
        }
        if (allAggregationPaths.indexOf(currentPath) !== -1) {
          console.error(
            `Cannot use the same prefix '${currentPath}' for aggregation deployment`
          );
          process.exit(1);
        }
        allAggregationPaths.push(currentPath);
        aggregationFunc.events.push({
          http: {
            method: ['get', 'post', 'put', 'delete', 'head'],
            path: currentPath,
          },
        });
      }

      result.push(aggregationFunc);
    }

    return result;
  }

  async fillYaml(
    document: Document.Parsed<any, true>,
    result: FunctionConfig[]
  ) {
    const cloned = document.clone();

    // 填充新的函数信息
    for (const functionConfig of result) {
      cloned.addIn(['functions', functionConfig.function.name], {
        handler: functionConfig.function.handler,
        events: functionConfig.events,
      });
    }

    writeFileSync(
      join(this.options.appDir, 'f.total.yml'),
      stringify(cloned),
      'utf8'
    );

    return undefined;
  }

  getAggregationFunName(aggregationName: string) {
    if (aggregationName === 'all') {
      return 'aggregationall';
    }
    return aggregationName;
  }

  static canSupport(options) {
    const filePath = join(options.appDir, 'f.yml');
    if (existsSync(filePath)) {
      const file = readFileSync(filePath, 'utf8');
      if (/@ali\/midway-fc-starter/.test(file)) {
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
const { BootstrapStarter } = require('@ali/midway-fc-starter');
const starter = new BootstrapStarter();

module.exports = starter.start({
  appDir: __dirname,
  baseDir: join(__dirname, 'dist'),
  initializeMethodName: 'initializer',
});
`;

    for (const funcInfo of result) {
      // 根据 handler 生成统一的入口文件
      const handler = funcInfo.function.handler;
      const filePrefix = handler.split('.')[0];
      const file = join(this.options.appDir, `${filePrefix}.js`);
      if (!existsSync(file)) {
        writeFileSync(join(this.options.appDir, `${filePrefix}.js`), tpl);
      }
    }
  }
}
