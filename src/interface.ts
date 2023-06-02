import type { RouterInfo } from '@midwayjs/core';

export interface GenerateOptions {
  baseDir?: string;
  appDir?: string;
}

export interface FunctionInformation {
  aggregationHttp?: boolean;
  aggregationHandler?: string;
  aggregationFunctionName?: string;
  functionList: RouterInfo[];
}
