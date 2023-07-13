import { GeneratorFactory } from './common/base';
import { GenerateOptions } from './interface';
import { FcGenerator } from './devs/fc';
import { GaiaGenerator } from './gaia';
import { AliFCGenerator } from './afc';

/**
 * 总入口
 * @param options
 */
async function generate(options: GenerateOptions) {
  const generatorFactory = new GeneratorFactory(options);
  generatorFactory.register(FcGenerator);
  generatorFactory.register(GaiaGenerator);
  generatorFactory.register(AliFCGenerator);
  const generator = generatorFactory.getGenerator();
  if (generator) {
    await generator.generate();
    console.log('[YAML] Generate success');
  } else {
    console.warn('[YAML] no generator found and skip generator');
  }
}

export { generate, FcGenerator };
