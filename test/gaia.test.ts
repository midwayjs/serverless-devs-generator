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
      baseDir: join(appDir, 'src')
    }, join(appDir, 'f.yml'), readFileSync(join(appDir, 'f.yml'), 'utf-8'));
    await generator.generate();

    expect(existsSync(join(appDir, 'helloService.js'))).toBeTruthy();
    expect(existsSync(join(appDir, 'spec.yml'))).toBeTruthy();

    unlinkSync(join(appDir, 'helloService.js'));
    unlinkSync(join(appDir, 'spec.yml'));
  });
});
