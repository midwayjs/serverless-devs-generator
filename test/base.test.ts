import { BaseGenerator } from '../src/common/base';
import { join } from 'path';
import { Document } from 'yaml';

describe('test base generator', function() {

  class TestGenerator extends BaseGenerator {
    static canSupport(baseDir: string) {
      return true;
    }

    analyzeFunction(result) {
      return [];
    }

    fillYaml(document): any {
    }
  }

  it('should get function metadata from application', async () => {
    const generator = new TestGenerator({
      baseDir: join(__dirname, './fixtures/faas/src'),
    }, '', '');
    const data = await generator.loadFunction();
    expect(JSON.stringify(data)).toMatch(/"functionName":"helloService-hello"/);
  });

  it('should test name', function() {
    const generator = new TestGenerator({}, '', '');
    expect(generator.createName({})).toEqual('default');
    expect(generator.createName({a: {}})).toEqual('37a8eec1ce');
    expect(generator.createName({a: {b: {}}})).toEqual('8f4c3b8abb');

    expect(generator.createName({
      'path': '/hello',
      'method': 'post'
    })).toEqual('d9892a5b83');

    expect(generator.createName({
      'path': '/hello',
      'method': ['post']
    })).toEqual('3ad927a44f');

    expect(generator.createName({
      'path': '/hello',
      'method': ['post', 'put']
    })).toEqual('f8d13a99b6');
  });

  it('should test setNodeObjectValue', function() {
    const generator = new TestGenerator({}, '', '');
    const document = new Document({d: {}, e: [], f: [{name: 'fc', value: 3}]});
    generator.setNodeObjectValue(['d', 'b', 'c'], {test: 1, test2: {data: ['c']}}, document);
    generator.setNodeObjectValue(['e'], {test: 1, test2: {data: ['c']}}, document);
    generator.setNodeObjectValue(['f'], {name: 'fc', data: 4, value: 2}, document, ['name']);
    expect(document.toJSON()).toMatchSnapshot();
  });

  it('should test setNodeObjectValue will be keep default value', function() {
    const generator = new TestGenerator({}, '', '');
    const document = new Document({d: {data: 1}});
    generator.setNodeObjectValue(['d'], {data: 2, test2: {data: ['c']}}, document);
    expect(document.toString()).toMatchSnapshot();
  });

  it('should test setNodeObjectValue will merge string array', function() {
    const generator = new TestGenerator({}, '', '');
    const document = new Document({d: ['a', 'b']});
    generator.setNodeObjectValue(['d'], 'c', document);
    expect(document.toString()).toMatchSnapshot();
  });

  it('should test fc yaml with trigger set', function() {
    const generator = new TestGenerator({}, '', '');
    const document = new Document({
      function: {
        name: 'helloService-hello',
        handler: 'index.handler',
        triggers: [
          {
            name: 'httpTrigger',
            type: 'http',
            config: {
              methods: [
                'GET'
              ]
            }
          }
        ]
      }
    });
    generator.setNodeObjectValue(['function'], {
      name: 'helloService-hello',
      handler: 'index.handler',
      triggers: [
        {
          name: 'httpTrigger',
          type: 'http',
          config: {
            methods: [
              'GET',
              'POST',
              'PUT'
            ]
          }
        }
      ]
    }, document, ['name']);
    expect(document.toString()).toMatchSnapshot();
  });
});
