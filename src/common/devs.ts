import { BaseGenerator } from './base';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GenerateOptions } from '../interface';
const ymlName = ['s.yaml', 's.yml'];

export abstract class ServerlessDevsGenerator<
  FunctionConfig = unknown
> extends BaseGenerator {
  static canSupport(options: GenerateOptions) {
    // check yaml file exists
    for (const name of ymlName) {
      const filePath = join(options.appDir, name);
      const fymlPath = join(options.appDir, 'f.yml');
      if (existsSync(filePath)) {
        const file = readFileSync(filePath, 'utf8');
        const fyml = readFileSync(fymlPath, 'utf8');
        if (this.isPlatformSupport(file, fyml)) {
          return [filePath, file];
        }
        return false;
      }
    }
    return false;
  }

  static isPlatformSupport(file: string, fyml: string) {
    return false;
  }
}
