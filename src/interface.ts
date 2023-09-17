import type { RouterInfo } from '@midwayjs/core';

export interface GenerateOptions {
  baseDir?: string;
  appDir?: string;
  pkgJSON?: any;
  /**
   * 原始 yaml 文件路径
   */
  sourceYamlPath?: string;
  /**
   * 填充写入的目标 yaml 文件路径
   */
  targetYamlPath?: string;
}

export interface GeneratorClz {
  canSupport(options: GenerateOptions): boolean | string[];
  new (options: GenerateOptions, sourceYamlContent: string): {
    generate(): void;
  };
}

export interface FunctionInformation {
  aggregationHttp?: boolean;
  aggregationHandler?: string;
  aggregationFunctionName?: string;
  functionList: RouterInfo[];
}
