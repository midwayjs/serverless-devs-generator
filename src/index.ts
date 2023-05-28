import { GeneratorFactory } from './common/base';
import { FcGenerator } from './devs/fc';

/**
 * 总入口
 * @param baseDir
 */
async function generate(baseDir = process.cwd()) {
  const generatorFactory = new GeneratorFactory(baseDir);
  generatorFactory.register(FcGenerator);
  const generator = generatorFactory.getGenerator();
  if (generator) {
    await generator.generate();
    console.log('generate success');
  } else {
    console.warn('no generator found and skip generator');
  }
}

export { generate, FcGenerator };
