import { Document, stringify, YAMLMap } from 'yaml';
import { BaseGenerator } from './common/base';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FunctionInformation } from './interface';
import * as micromatch from 'micromatch';
import { format } from 'util';

type FunctionConfig = {
  functionName?: string;
  handler?: string;
  events?: Array<{
    [type: 'http' | 'timer' | 'hsf' | 'mtop' | 'mq' | string]: any;
  }>;
  _isAggregation?: boolean;
  _handlers?: string[];
  _allAggred?: any[];
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

function formatAggregationHandlers(handlers) {
  if (!handlers || !handlers.length) {
    return [];
  }
  return handlers
    .map(handler => {
      const { path = '', eventType } = handler;
      if (eventType !== 'http') {
        return {
          ...handler,
          level: -1,
        };
      }
      return {
        ...handler,
        method: (handler.method ? [].concat(handler.method) : []).map(
          method => {
            return method.toLowerCase();
          }
        ),
        handler: handler.handler,
        router: path.replace(/\*/g, '**'), // picomatch use **
        pureRouter: path.replace(/\**$/, ''),
        regRouter: path.replace(/\/\*$/, '/(.*)?') || '/(.*)?', // path2regexp match use (.*)?
        level: path.split('/').length - 1,
        paramsMatchLevel: path.indexOf('/:') !== -1 ? 1 : 0,
      };
    })
    .sort((handlerA, handlerB) => {
      if (handlerA.level === handlerB.level) {
        if (handlerA.level < 0) {
          return -1;
        }
        if (handlerB.pureRouter === handlerA.pureRouter) {
          return handlerA.router.length - handlerB.router.length;
        }
        if (handlerA.paramsMatchLevel === handlerB.paramsMatchLevel) {
          return handlerB.pureRouter.length - handlerA.pureRouter.length;
        }
        return handlerA.paramsMatchLevel - handlerB.paramsMatchLevel;
      }
      return handlerB.level - handlerA.level;
    });
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
            functionName: funcName,
            handler,
            events: [],
          };
        }

        if (!allFunc[funcName].functionName) {
          allFunc[funcName].functionName = funcName;
        }

        if (!allFunc[funcName]?.events) {
          allFunc[funcName].events = [];
        }

        if (!allFunc[funcName]?.handler) {
          allFunc[funcName].handler = handler;
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
        if (['hsf', 'mtop'].includes(triggerType)) {
          obj[triggerType] = true;
        } else {
          obj[triggerType] = newTriggerConfig;
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

    let allFuncNames = result.map(func => func.functionName);

    for (const aggregationName in aggregationInformation) {
      const aggregationConfig = aggregationInformation[aggregationName];
      const aggregationFuncName = this.getAggregationFunName(aggregationName);

      const aggregationFunc = {
        functionName: aggregationFuncName,
        handler: `${aggregationFuncName}.handler`,
        _isAggregation: true,
        events: [],
      } as FunctionConfig;

      // 忽略原始方法，不再单独进行部署
      const deployOrigin = aggregationConfig.deployOrigin;

      let handlers = [];
      const allAggredHttpTriggers = [];
      const allAggredEventTriggers = [];
      if (aggregationConfig.functions || aggregationConfig.functionsPattern) {
        const matchedFuncName = [];
        const notMatchedFuncName = [];
        for (const functionName of allFuncNames) {
          const func = result.find(func => func.functionName === functionName);
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
              aggregationConfig.functions.indexOf(func.functionName) !== -1;
          } else if (aggregationConfig.functionsPattern) {
            isMatch = micromatch.all(
              func.functionName,
              aggregationConfig.functionsPattern
            );
          }
          if (isMatch) {
            matchedFuncName.push(func.functionName);
          } else {
            notMatchedFuncName.push(func.functionName);
          }
        }
        allFuncNames = notMatchedFuncName;
        matchedFuncName.forEach((functionName: string) => {
          const func = result.find(func => func.functionName === functionName);
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
                func => func.functionName === functionName
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
    const serviceName = cloned.hasIn(['service', 'name']);
    if (!serviceName && cloned.has('service')) {
      const name = cloned.get('service');
      cloned.delete('service');
      cloned.setIn(['service', 'name'], name);
    }

    // 填充新的函数信息
    for (const functionConfig of result) {
      cloned.addIn(['functions', functionConfig.functionName], {
        handler: functionConfig.handler,
        events: functionConfig.events,
      });
    }

    writeFileSync(
      join(this.options.appDir, 'f.total.yml'),
      stringify(cloned),
      'utf8'
    );

    // 写一个所有函数名+handler的文件，方便脚本处理
    const allFunctionNames = result.map(
      func => `${func.functionName}_${func.handler}`
    );
    writeFileSync(
      join(this.options.appDir, 'all_function_name'),
      allFunctionNames.join(':'),
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
    const aggrTpl = `const { join } = require('path');
const { BootstrapStarter } = require('@ali/midway-fc-starter');
const starter = new BootstrapStarter();

module.exports = starter.start({
  appDir: __dirname,
  baseDir: join(__dirname, 'dist'),
  initializeMethodName: 'initializer',
  aggregationHandlerName: '%s',
  handlerNameMapping: (handlerName, event, context, oldContext) => {
    const allHandlers = %s;
    if (typeof allHandlers !== 'undefined') {
      let newEvent = event;
      // 阿里云事件触发器，入参是 buffer
      if (Buffer.isBuffer(newEvent)) {
        newEvent = newEvent.toString('utf8');
        try {
          newEvent = JSON.parse(newEvent);
        } catch (_err) {
          /** ignore */
        }
      }
      // hsf
      if (newEvent && newEvent.func) {
        const handlerInfo = allHandlers.find(handler => {
          return handler.functionName === newEvent.func;
        });
        if (handlerInfo) {
          return [handlerInfo.handler, Buffer.from(JSON.stringify(newEvent.event)), context, oldContext];
        }
      }
      // mtop
      if (newEvent && newEvent.mtopApp && newEvent.parameters && newEvent.parameters.fcArgs) {
        const fcArgs = JSON.parse(newEvent.parameters.fcArgs);
        if (fcArgs.func) {
          const handlerInfo = allHandlers.find(handler => {
            return handler.functionName === fcArgs.func;
          });
          if (handlerInfo) {
            newEvent.parameters.fcArgs = JSON.stringify(fcArgs.event);
            newEvent.parameters.fcName = handlerInfo.functionName;
            return [handlerInfo.handler, Buffer.from(JSON.stringify(newEvent)), context, oldContext];
          }
        }
      }
    }
    return [handlerName, event, context, oldContext];
  },
});
`;

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
      const file = join(
        this.options.appDir,
        `${funcInfo.functionName}.entry.js`
      );

      if (!existsSync(file)) {
        if (funcInfo._isAggregation) {
          const handlers = formatAggregationHandlers(funcInfo._handlers) || [];
          writeFileSync(
            file,
            format(aggrTpl, funcInfo.handler, JSON.stringify(handlers, null, 2))
          );
        } else {
          writeFileSync(file, tpl);
        }
      }
    }
  }
}
