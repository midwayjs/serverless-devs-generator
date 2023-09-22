import { Document, isCollection, isSeq, ParsedNode, parseDocument } from 'yaml';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import {
  FunctionInformation,
  GenerateOptions,
  GeneratorClz,
} from '../interface';
import { join, resolve, isAbsolute } from 'path';

export abstract class BaseGenerator<AnalyzeFunctionResult = unknown> {
  protected document: Document.Parsed<ParsedNode, true>;
  constructor(
    protected options: GenerateOptions,
    /**
     * yaml 文件路径
     * @deprecated
     */
    protected sourceYamlPath?: string,
    /**
     * yaml 内容
     * @deprecated
     */
    protected sourceYamlContent?: string
  ) {}

  /**
   * 使用 hash，根据配置值创建唯一名
   * @param config
   */
  public createName(config: Record<string, any> = {}): string {
    const values = Object.values(config);

    const v = [];
    for (const value of values) {
      if (typeof value === 'string') {
        v.push(value);
      } else if (typeof value === 'object') {
        v.push(this.createName(value));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            v.push(item);
          } else if (typeof item === 'object') {
            v.push(this.createName(item));
          }
        }
      }
    }

    if (v.length === 0) {
      return 'default';
    }
    const hash = createHash('sha256');
    return hash.update(v.join('-')).digest('hex').slice(0, 10);
  }

  /**
   * 获取 midway 装饰器标注的函数信息
   * @returns
   */
  public async loadFunction(): Promise<FunctionInformation> {
    const {
      MidwayConfigService,
      MidwayFrameworkService,
      MidwayServerlessFunctionService,
      prepareGlobalApplicationContextAsync,
      CONFIGURATION_KEY,
      listModule,
      Types,
    } = require('@midwayjs/core');

    const moduleLoadType =
      this.options.pkgJSON?.type === 'module' ? 'esm' : 'commonjs';

    const applicationContext = await prepareGlobalApplicationContextAsync({
      baseDir: this.options.baseDir,
      appDir: this.options.appDir,
      moduleLoadType,
      globalConfig: {
        midwayLogger: {
          default: {
            enableFile: false,
            enableError: false,
          },
        },
      },
    });
    await applicationContext.getAsync(MidwayFrameworkService, [
      applicationContext,
    ]);
    const cycles = listModule(CONFIGURATION_KEY);
    for (const cycle of cycles) {
      if (cycle.target && Types.isClass(cycle.target)) {
        await applicationContext.getAsync(cycle.target);
      }
    }
    const midwayServerlessFunctionService = applicationContext.get(
      MidwayServerlessFunctionService
    );

    const midwayConfigService = applicationContext.get(MidwayConfigService);

    return {
      aggregationHttp:
        midwayConfigService.getConfiguration('faas.aggregationHttp') || false,
      aggregationHandler:
        midwayConfigService.getConfiguration('faas.aggregationHandler') ||
        'index.handler',
      aggregationFunctionName:
        midwayConfigService.getConfiguration('faas.aggregationFunctionName') ||
        'http-index',
      functionList: await midwayServerlessFunctionService.getFunctionList(),
    };
  }

  public async generate() {
    if (this.sourceYamlPath) {
      this.options.sourceYamlPath = this.sourceYamlPath;
    }

    if (this.sourceYamlContent) {
      this.options.sourceYamlContent = this.sourceYamlContent;
    }

    if (!this.options.sourceYamlContent) {
      if (!this.options.sourceYamlPath) {
        throw new Error(
          'sourceYamlPath is required when sourceYamlContent is empty'
        );
      }

      if (!isAbsolute(this.options.sourceYamlPath)) {
        this.options.sourceYamlPath = join(
          this.options.appDir,
          this.options.sourceYamlPath
        );
      }

      this.options.sourceYamlContent = readFileSync(
        this.options.sourceYamlPath,
        'utf-8'
      );
    }

    if (
      this.options.targetYamlPath &&
      !isAbsolute(this.options.targetYamlPath)
    ) {
      this.options.targetYamlPath = join(
        this.options.appDir,
        this.options.targetYamlPath
      );
    }

    this.document = parseDocument(this.options.sourceYamlContent);
    const data = await this.loadFunction();
    const result = this.analyzeFunction(data);
    await this.generateEntry(data, result);
    if (this.options.targetYamlPath) {
      const updatedYamlString = await this.fillYaml(result);
      writeFileSync(this.options.targetYamlPath, updatedYamlString);
    }
  }

  /**
   * 设置对象的值，递归循环 yaml 的对象结构，如果值存在则覆盖，如果不存在则添加
   * @param path
   * @param value
   * @param baseNode
   * @param objectArrayMatchKeyWordList 在匹配对象数组的时候，需要传递一个匹配的关键字，比如 name，每一种类对象数组都需要传递一个匹配的关键字
   */
  setNodeObjectValue(
    path: Iterable<unknown> | null,
    value: Record<string, any> | string,
    baseNode?: any,
    objectArrayMatchKeyWordList?: string[]
  ) {
    const document = baseNode ?? this.document;
    let node = document.getIn(path);
    if (!node) {
      document.setIn(path, {});
      node = document.getIn(path);
    }

    if (isSeq(node)) {
      // 如果是对象数组，则需要进行对象查找和合并
      if (
        objectArrayMatchKeyWordList &&
        objectArrayMatchKeyWordList.length > 0
      ) {
        // 如果传入了对象数组的查询匹配 keyWord，则需要进行对象查找和合并
        const matchedKey = objectArrayMatchKeyWordList.shift();
        // value 有可能有多个，对象也变成对象数组处理
        value = [].concat(value);
        for (const v of value as any[]) {
          // 这里的数组对象查找，只支持唯一的一个
          const matched = node.items.findIndex(item => {
            if (isCollection(item)) {
              if (
                item.has(matchedKey) &&
                item.get(matchedKey) === v[matchedKey]
              ) {
                return true;
              }
            }
            return false;
          });
          if (matched !== -1) {
            this.setNodeObjectValue([matched], v, node, [
              ...objectArrayMatchKeyWordList,
            ]);
          } else {
            node.items.push(v);
          }
        }
      } else {
        // 如果是数组，则直接覆盖
        node.items = [].concat(value);
      }
    } else if (isCollection(node)) {
      // 蜀国是数组简单处理，直接覆盖
      if (typeof value === 'object') {
        for (const key in value) {
          // 对象内容直接设置
          node.setIn([key], value[key]);
        }
      }
    }

    return document;
  }

  abstract analyzeFunction(
    result: FunctionInformation
  ): AnalyzeFunctionResult | AnalyzeFunctionResult[];
  abstract fillYaml(
    result: AnalyzeFunctionResult | AnalyzeFunctionResult[],
    document?: Document | Document.Parsed<ParsedNode, true>
  ): undefined | string | Promise<string | undefined>;
  abstract generateEntry(
    information: FunctionInformation,
    config: AnalyzeFunctionResult | AnalyzeFunctionResult[]
  ): Promise<void>;

  /**
   * 检查该 generator 是否能被应用
   * @param options
   */
  static canSupport(options: GenerateOptions): boolean | string[] {
    return false;
  }
}

export class GeneratorFactory {
  constructor(protected options: GenerateOptions) {
    if (!this.options.appDir) {
      this.options.appDir = process.cwd();
    } else {
      this.options.appDir = resolve(this.options.appDir);
    }
    if (!this.options.baseDir) {
      const tsconfig =
        require(join(this.options.appDir, 'tsconfig.json')) || {};
      this.options.baseDir = join(
        this.options.appDir,
        tsconfig?.compilerOptions?.outDir || 'dist'
      );
    }

    if (!this.options.pkgJSON) {
      this.options.pkgJSON =
        require(join(this.options.appDir, 'package.json')) || {};
    }

    if (!existsSync(this.options.baseDir)) {
      throw new Error(
        `The baseDir ${this.options.baseDir} is not exists, please build first.`
      );
    }
  }
  private generators = new Set<GeneratorClz>();
  register(generatorImpl: GeneratorClz) {
    this.generators.add(generatorImpl);
  }

  getGenerator() {
    for (const GeneratorClz of this.generators) {
      const canSupport = GeneratorClz.canSupport(this.options);
      if (canSupport) {
        return new GeneratorClz({
          ...this.options,
          sourceYamlPath: canSupport[0],
          sourceYamlContent: canSupport[1],
        });
      }
    }
  }
}
