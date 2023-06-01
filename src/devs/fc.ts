import { Document, visit, Scalar, YAMLMap } from 'yaml';
import { RouterInfo } from '@midwayjs/core';
import { ServerlessDevsGenerator } from '../common/devs';

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
  analyzeFunction(result: RouterInfo[]) {
    const allFunc: {
      [functionName: string]: FunctionConfig;
    } = {};
    if (Array.isArray(result)) {
      for (const func of result) {
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

  fillYaml(
    document: Document | Document.Parsed<any, true>,
    result: FunctionConfig[]
  ) {
    let originComponentNode;

    visit(document, {
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
            this.setNodeObjectValue(
              ['props'],
              functionConfig,
              fcComponentNode,
              ['name']
            );
            // 删除该节点
            result.splice(findFunctionConfigIdx, 1);
          }
        }
      },
    });

    if (!result.length) {
      return document;
    }

    // 填充新的函数信息
    for (const functionConfig of result) {
      // 克隆现有节点，移除函数名等信息
      const newFcComponentNode = originComponentNode.clone();
      newFcComponentNode.deleteIn(['props', 'function']);
      newFcComponentNode.deleteIn(['props', 'triggers']);
      newFcComponentNode.deleteIn(['props', 'customDomains']);

      const newProjectName = this.createName(functionConfig);
      this.setNodeObjectValue(['props'], functionConfig, newFcComponentNode);
      document.addIn(
        ['services', 'project-' + newProjectName],
        newFcComponentNode
      );
    }

    return document;
  }

  allowTriggerConfig(type: string): string[] {
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

  static isPlatformSupport(file): boolean {
    return /devsapp\/fc/.test(file);
  }
}
