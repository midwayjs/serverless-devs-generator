import {
  visit,
  Scalar,
  YAMLMap,
  isCollection,
  stringify,
  ParsedNode,
  Document,
} from 'yaml';
import { ServerlessDevsGenerator } from '../common/devs';
import { FunctionInformation } from '../interface';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';

type FunctionConfig = {
  function: {
    name?: string;
    handler?: string;
  };
  triggers?: Array<{
    name: string;
    type:
      | 'http'
      | 'oss'
      | 'timer'
      | 'log'
      | 'mns_topic'
      | 'cdn_events'
      | 'tablestore'
      | 'eventbridge'
      | string;
    config: any;
  }>;
};

export class FcGenerator extends ServerlessDevsGenerator<FunctionConfig> {
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
            triggers: [],
          };
        }

        if (!allFunc[funcName]?.triggers) {
          allFunc[funcName].triggers = [];
        }

        if (!allFunc[funcName]?.function.handler) {
          allFunc[funcName].function.handler = handler;
        }

        delete func.functionTriggerMetadata.functionName;
        delete func.functionTriggerMetadata.middleware;

        const triggerType = func.functionTriggerName;
        let triggerName = func.functionTriggerMetadata?.name;

        if (!triggerName) {
          triggerName =
            triggerType + '-' + this.createName(func.functionTriggerMetadata);
        }

        // 发布时候需要触发器名字，只允许第一个http触发器叫 http
        const triggerNameExists = allFunc[funcName].triggers.find(trigger => {
          return trigger.name === triggerName;
        });

        // 如果名字不唯一，则报错
        if (triggerNameExists) {
          throw new Error(
            `Current trigger name "${triggerName}" not unique, please configure name in @ServerlessTrigger.`
          );
        }

        if (triggerType === 'http') {
          // 对 http 方法 any 的支持
          const { method } = func.functionTriggerMetadata;
          let methodList = [].concat(method || []);
          if (methodList.includes('any') || methodList.includes('all')) {
            func.functionTriggerMetadata.method = 'any';
            methodList = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
          }

          func.functionTriggerMetadata.methods = methodList.map(method => {
            return method.toUpperCase();
          });

          func.functionTriggerMetadata.authType =
            func.functionTriggerMetadata.authType || 'anonymous';
        }

        const newTriggerConfig = {};
        for (const key in func.functionTriggerMetadata) {
          if (this.allowTriggerConfig(triggerType).includes(key)) {
            newTriggerConfig[key] = func.functionTriggerMetadata[key];
          }
        }

        allFunc[funcName].triggers.push({
          name: triggerName,
          type: triggerType,
          config: newTriggerConfig,
        });
      }
    }

    return Object.values(allFunc);
  }

  fillFunction(node: YAMLMap, functionConfig: FunctionConfig) {
    // 克隆 functionConfig，避免后续数据被篡改
    functionConfig = JSON.parse(JSON.stringify(functionConfig));
    // 过滤触发器下不允许的字段
    if (functionConfig.triggers) {
      for (const trigger of functionConfig.triggers) {
        // 移除 yaml 中不允许的配置
        for (const key in trigger.config) {
          if (!this.allowTriggerYamlConfig(trigger.type).includes(key)) {
            delete trigger.config[key];
          }
        }
      }
    }

    // 填充函数名
    node.setIn(['props', 'function', 'name'], functionConfig.function.name);
    // 填充函数 handler
    node.setIn(
      ['props', 'function', 'handler'],
      functionConfig.function.handler
    );

    // 填充触发器
    if (functionConfig.triggers) {
      for (const trigger of functionConfig.triggers) {
        // 根据触发器名字，在 triggers 是数组查找同名触发器信息，填充触发器
        const triggerNode = node.getIn(['props', 'triggers']) as any;
        if (triggerNode) {
          const matched = triggerNode.items.findIndex(item => {
            if (isCollection(item)) {
              if (item.has('name') && item.get('name') === trigger.name) {
                return true;
              }
              return false;
            }
            return false;
          });
          if (matched !== -1) {
            // 找到了
            const tr = triggerNode.getIn([matched]);
            tr.setIn(['type'], trigger.type);
            this.setNodeObjectValue(['config'], trigger.config, tr);
          } else {
            // 没找到，新增触发器
            triggerNode.items.push(trigger);
          }
        } else {
          // 没有触发器字段，新增触发器
          node.setIn(['props', 'triggers'], [trigger]);
        }
      }
    }
  }

  fillRoute(node: YAMLMap, functionConfig: FunctionConfig) {
    if (functionConfig.triggers) {
      for (const trigger of functionConfig.triggers) {
        if (trigger.type === 'http') {
          // 只有 http 触发器才有路由
          const path = trigger.config.path;
          if (path) {
            node.setIn(
              ['props', 'customDomains'],
              [
                {
                  domainName: path,
                  protocol: 'HTTP',
                },
              ]
            );
          }
        }
      }
    }
  }

  fillYaml(
    result: FunctionConfig[],
    document?: Document | Document.Parsed<ParsedNode, true>
  ) {
    let originComponentNode;
    const newDocument = (document || this.document).clone();

    visit(newDocument, {
      Value: (key, node: Scalar, path) => {
        if (node.value === 'devsapp/fc') {
          const fcComponentNode = path[path.length - 2] as YAMLMap;
          if (!originComponentNode) {
            originComponentNode = fcComponentNode;
          }
          const fnName = fcComponentNode.getIn(['props', 'function', 'name']);
          // 查找同名的函数节点
          const findFunctionConfigIdx = result.findIndex(functionConfig => {
            return functionConfig.function.name === fnName;
          });

          // 如果找到同名的，则填充函数信息，并且在原数组中移除
          if (findFunctionConfigIdx !== -1) {
            // 将信息填充到 yaml 节点中
            const functionConfig = result[findFunctionConfigIdx];
            this.fillFunction(fcComponentNode, functionConfig);
            // this.fillRoute(fcComponentNode, functionConfig);
            // 删除该节点
            result.splice(findFunctionConfigIdx, 1);
          }
        }
      },
    });

    if (!result.length) {
      return stringify(newDocument, { indent: 2 });
    }

    // 填充新的函数信息
    for (const functionConfig of result) {
      let newFcComponentNode;
      if (!originComponentNode) {
        // 加一个新的节点，一般初始化才会走到这里
        newFcComponentNode = new YAMLMap();
        newFcComponentNode.add({
          key: 'component',
          value: 'devsapp/fc',
        });

        const node = newDocument.createNode({
          region: 'cn-hangzhou',
          service: '${vars.service}',
          function: functionConfig.function,
          triggers: functionConfig.triggers,
        });

        newFcComponentNode.add({
          key: 'props',
          value: node,
        });
      } else {
        // 克隆现有节点，移除函数名等信息
        newFcComponentNode = originComponentNode.clone();
        newFcComponentNode.deleteIn(['props', 'function']);
        newFcComponentNode.deleteIn(['props', 'triggers']);
        newFcComponentNode.deleteIn(['props', 'customDomains']);
      }

      this.fillFunction(newFcComponentNode, functionConfig);
      const newProjectName = this.createName(functionConfig);
      newDocument.addIn(
        ['services', 'project-' + newProjectName],
        newFcComponentNode
      );
    }

    return stringify(newDocument, { indent: 2 });
  }

  allowTriggerYamlConfig(type: string): string[] {
    switch (type) {
      case 'http':
        return ['authType', 'disableURLInternet', 'methods'];
      case 'timer':
        return ['cronExpression', 'enable', 'payload'];
      case 'oss':
        return ['bucketName', 'events', 'filter'];
      case 'log':
        return [
          'logConfig',
          'sourceConfig',
          'jobConfig',
          'functionParameter',
          'enable',
        ];
      case 'mns_topic':
        return [
          'topicName',
          'region',
          'notifyContentFormat',
          'notifyStrategy',
          'filterTag',
        ];
      case 'cdn_events':
        return ['eventName', 'eventVersion', 'notes', 'filter'];
      case 'tablestore':
        return ['instanceName', 'tableName'];
    }
  }

  allowTriggerConfig(type: string): string[] {
    const result = this.allowTriggerYamlConfig(type);
    if (type === 'http') {
      result.push('path');
    }
    return result;
  }

  static isPlatformSupport(file, fyml): boolean {
    return /aliyun/.test(fyml);
  }

  async generateEntry(
    information: FunctionInformation,
    config: FunctionConfig[]
  ): Promise<void> {
    let tpl = `
const { BootstrapStarter } = require('@midwayjs/fc-starter');
const starter = new BootstrapStarter();

module.exports = starter.start({
  appDir: __dirname,
  initializeMethodName: 'initializer',
});
`;

    const isESM = this.options.pkgJSON?.type === 'module';
    if (isESM) {
      tpl = `
import { BootstrapStarter } from '@midwayjs/fc-starter';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const starter = new BootstrapStarter();

export default starter.start({
  appDir: dirname(fileURLToPath(import.meta.url)),
  initializeMethodName: 'initializer',
});
`;
    }

    for (const funcInfo of config) {
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
