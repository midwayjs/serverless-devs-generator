import { GeneratorFactory } from './common/base';
import { FcGenerator } from './devs/fc';
import { GenerateOptions } from './interface';

/**
 * 总入口
 * @param options
 */
async function generate(options: GenerateOptions) {
  const generatorFactory = new GeneratorFactory(options);
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
