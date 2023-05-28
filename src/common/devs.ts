import { BaseGenerator } from './base';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
const ymlName = ['s.yaml', 's.yml'];

export abstract class ServerlessDevsGenerator<
  FunctionConfig = unknown
> extends BaseGenerator {
  static canSupport(baseDir: string) {
    // check yaml file exists
    for (const name of ymlName) {
      const filePath = join(baseDir, name);
      if (existsSync(filePath)) {
        const file = readFileSync(filePath, 'utf8');
        if (this.isPlatformSupport(file)) {
          return [filePath, file];
        }
        return false;
      }
    }
    return false;
  }

  static isPlatformSupport(file: string) {
    return false;
  }
}
