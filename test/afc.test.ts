import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { AliFCGenerator } from '../src/afc';

function cleanFiles(appDir: string, files: string[]) {
  for (const file of files) {
    if (existsSync(join(appDir, file))) {
      unlinkSync(join(appDir, file));
    }
  }
}

describe('test/afc.test.ts', function() {
  it('should can support', function() {
    const result = AliFCGenerator.canSupport({
      appDir: join(__dirname, './fixtures/afc'),
    }) as string[];
    expect(result.length).toEqual(2);
  });

  it('should generate f.total.yml from f.yml', async() => {
    const appDir = join(__dirname, './fixtures/afc');
    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'app.entry.js', 'helloService-hello1.entry.js']);
    const generator = new AliFCGenerator({
      appDir,
      baseDir: join(appDir, 'src'),
      sourceYamlPath: 'f.yml',
    });
    await generator.generate();

    expect(existsSync(join(appDir, 'f.total.yml'))).toBeTruthy();
    expect(existsSync(join(appDir, 'app.entry.js'))).toBeTruthy();
    expect(readFileSync(join(appDir, 'f.total.yml'), 'utf-8')).toMatchSnapshot();
    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'app.entry.js', 'helloService-hello1.entry.js']);
  });

  it('should generate from aggr', async() => {
    const appDir = join(__dirname, './fixtures/afc-aggr');
    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'allEvent.entry.js', 'allHttp.entry.js']);
    const generator = new AliFCGenerator({
      appDir,
      baseDir: join(appDir, 'src'),
      sourceYamlPath: 'f.yml',
    });
    await generator.generate();

    expect(existsSync(join(appDir, 'f.total.yml'))).toBeTruthy();
    expect(existsSync(join(appDir, 'allEvent.entry.js'))).toBeTruthy();
    expect(readFileSync(join(appDir, 'f.total.yml'), 'utf-8')).toMatchSnapshot();

    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'allEvent.entry.js', 'allHttp.entry.js']);
  });

  it('should generate from aggr with ignore', async() => {
    const appDir = join(__dirname, './fixtures/afc-aggr-ignore');
    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'api.entry.js', 'normal.entry.js', 'render2.entry.js', 'renderNot2.entry.js']);

    const generator = new AliFCGenerator({
      appDir,
      baseDir: join(appDir, 'src'),
      sourceYamlPath: 'f.yml',
    });
    await generator.generate();

    expect(existsSync(join(appDir, 'f.total.yml'))).toBeTruthy();
    expect(readFileSync(join(appDir, 'f.total.yml'), 'utf-8')).toMatchSnapshot();

    cleanFiles(appDir, ['all_function_name', 'f.total.yml', 'api.entry.js', 'normal.entry.js', 'render2.entry.js', 'renderNot2.entry.js']);
  });
});
