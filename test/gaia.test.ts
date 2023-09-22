import { GaiaGenerator } from '../src/gaia';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';

describe('test/gaia.test.ts', function() {
  it('should can support', function() {
    const result = GaiaGenerator.canSupport({
      appDir: join(__dirname, './fixtures/gaia'),
    }) as string[];
    expect(result.length).toEqual(2);
  });
  it('should generate spec.yml from f.yml', async() => {
    const appDir = join(__dirname, './fixtures/gaia');
    if (existsSync(join(appDir, 'helloService.js'))) {
      unlinkSync(join(appDir, 'helloService.js'));
    }
    const generator = new GaiaGenerator({
      appDir,
      baseDir: join(appDir, 'src'),
      sourceYamlPath: join(appDir, 'f.yml'),
    });
    await generator.generate();

    expect(existsSync(join(appDir, 'index.js'))).toBeTruthy();
    expect(existsSync(join(appDir, 'spec.yml'))).toBeTruthy();
    expect(readFileSync(join(appDir, 'spec.index.handler.yml'), 'utf-8')).toMatchSnapshot();
    expect(readFileSync(join(appDir, 'spec.index.hello.yml'), 'utf-8')).toMatchSnapshot();

    unlinkSync(join(appDir, 'index.js'));
    unlinkSync(join(appDir, 'spec.yml'));
    unlinkSync(join(appDir, 'spec.index.handler.yml'));
    unlinkSync(join(appDir, 'spec.index.hello.yml'));
  });
});
