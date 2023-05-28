import { join } from 'path';
import { FcGenerator } from '../src/devs/fc';
import { Document } from 'yaml';

describe('test serverless devs yaml generate fc case', () => {
  it('should test yaml parse and stringify', () => {
    const [file, content] = FcGenerator.canSupport(join(__dirname, './fixtures/base')) as string[];
    expect(file).toEqual(join(__dirname, './fixtures/base/s.yaml'));
    expect(content).toMatchSnapshot();
  });

  describe('analyzeFunction', function() {
    it('should transform single http trigger', function() {
      const generator = new FcGenerator('', '', '');
      const result = generator.analyzeFunction([{
        'prefix': '/',
        'routerName': '',
        'url': '/hello',
        'requestMethod': 'post',
        'method': 'hello',
        'handlerName': 'helloService.hello',
        'funcHandlerName': 'helloService.hello',
        'controllerId': 'helloService',
        'middleware': [],
        'controllerMiddleware': [],
        'requestMetadata': [],
        'responseMetadata': [],
        'functionName': 'helloService-hello',
        'functionTriggerName': 'http',
        'functionTriggerMetadata': {
          'path': '/hello',
          'method': 'post'
        },
        'functionMetadata': {
          'functionName': 'helloService-hello'
        },
        'fullUrl': '/hello',
        'fullUrlFlattenString': '/hello'
      }]);

      expect(result).toMatchSnapshot();
    });

    it('should transform multi http trigger with same function', function() {
      const generator = new FcGenerator('', '', '');
      const result = generator.analyzeFunction([{
        'prefix': '/',
        'routerName': '',
        'url': '/hello',
        'requestMethod': 'post',
        'method': 'hello',
        'handlerName': 'helloService.hello',
        'funcHandlerName': 'helloService.hello',
        'controllerId': 'helloService',
        'middleware': [],
        'controllerMiddleware': [],
        'requestMetadata': [],
        'responseMetadata': [],
        'functionName': 'helloService-hello',
        'functionTriggerName': 'http',
        'functionTriggerMetadata': {
          'path': '/hello',
          'method': 'post'
        },
        'functionMetadata': {
          'functionName': 'helloService-hello'
        },
        'fullUrl': '/hello',
        'fullUrlFlattenString': '/hello'
      },
        {
          'prefix': '/',
          'routerName': '',
          'url': '/*',
          'requestMethod': 'get',
          'method': 'hello',
          'description': '',
          'summary': '',
          'handlerName': 'helloService.hello',
          'funcHandlerName': 'helloService.hello',
          'controllerId': 'helloService',
          'middleware': [],
          'controllerMiddleware': [],
          'requestMetadata': [],
          'responseMetadata': [],
          'functionName': 'helloService-hello',
          'functionTriggerName': 'http',
          'functionTriggerMetadata': {
            'path': '/*',
            'method': 'get'
          },
          'functionMetadata': {
            'functionName': 'helloService-hello'
          },
          'fullUrl': '/*',
          'fullUrlFlattenString': '/(.*)'
        }
      ]);

      expect(result).toMatchSnapshot();
    });

    it('should transform multi trigger mixin', function() {
      const generator = new FcGenerator('', '', '');
      const result = generator.analyzeFunction([{
        'url': '/hello',
        'requestMethod': 'post',
        'method': 'hello',
        'funcHandlerName': 'helloService.hello',
        'functionName': 'helloService-hello',
        'functionTriggerName': 'http',
        'functionTriggerMetadata': {
          'path': '/hello',
          'method': 'post'
        },
        'functionMetadata': {
          'functionName': 'helloService-hello'
        },
      },
        {
          'url': '/*',
          'requestMethod': 'get',
          'method': 'hello',
          'funcHandlerName': 'helloService.hello',
          'functionName': 'helloService-hello',
          'functionTriggerName': 'http',
          'functionTriggerMetadata': {
            'path': '/*',
            'method': 'get'
          },
          'functionMetadata': {
            'functionName': 'helloService-hello'
          },
        },
        {
          "url": "",
          "requestMethod": "",
          "method": "hello",
          "handlerName": "helloService.timer",
          "funcHandlerName": "helloService.timer",
          "functionName": "helloService-hello",
          "functionTriggerName": "timer",
          "functionTriggerMetadata": {
            "cronExpression": "0 0 4 * * *"
          },
          "functionMetadata": {
            "functionName": "helloService-timer"
          },
        }
      ]);

      expect(result).toMatchSnapshot();
    });

    it('should test http trigger method any', function() {
      const generator = new FcGenerator('', '', '');
      const result = generator.analyzeFunction([{
        'url': '/hello',
        'requestMethod': 'post',
        'method': 'hello',
        'funcHandlerName': 'helloService.hello',
        'functionName': 'helloService-hello',
        'functionTriggerName': 'http',
        'functionTriggerMetadata': {
          'path': '/hello',
          'method': ['any']
        },
        'functionMetadata': {
          'functionName': 'helloService-hello'
        },
      }]);

      expect(result).toMatchSnapshot();
    });

    it('should test http trigger method all', function() {
      const generator = new FcGenerator('', '', '');
      const result = generator.analyzeFunction([{
        'url': '/hello',
        'requestMethod': 'post',
        'method': 'hello',
        'funcHandlerName': 'helloService.hello',
        'functionName': 'helloService-hello',
        'functionTriggerName': 'http',
        'functionTriggerMetadata': {
          'path': '/hello',
          'method': 'all'
        },
        'functionMetadata': {
          'functionName': 'helloService-hello'
        },
      }]);

      expect(result).toMatchSnapshot();
    });

    it('should test unique trigger name', function() {
      const generator = new FcGenerator('', '', '');
      expect(() => {
        generator.analyzeFunction([{
          'url': '/hello',
          'requestMethod': 'post',
          'method': 'hello',
          'funcHandlerName': 'helloService.hello',
          'functionName': 'helloService-hello',
          'functionTriggerName': 'http',
          'functionTriggerMetadata': {
            'path': '/hello',
            'method': 'all',
            'name': 'abc'
          },
          'functionMetadata': {
            'functionName': 'helloService-hello'
          },
        },
          {
            'url': '/hello',
            'requestMethod': 'post',
            'method': 'hello',
            'funcHandlerName': 'helloService.hello',
            'functionName': 'helloService-hello',
            'functionTriggerName': 'http',
            'functionTriggerMetadata': {
              'path': '/bbb',
              'method': 'post',
              'name': 'abc'
            },
            'functionMetadata': {
              'functionName': 'helloService-hello'
            },
          }]);
      }).toThrowError();
    });
  });

  describe('fillYaml', function() {
    it('should fill yaml with single function mixin', function() {
      const generator = new FcGenerator('', '', '');
      const document = generator.fillYaml(new Document({
        services: {
          project1: {
            component: 'devsapp/fc',
            props: {
              region: 'cn-hangzhou',
              service: '${vars.service}',
              function: {
                name: 'helloService-hello',
              },

            }
          }
        }
      }), [
        {
          "function": {
            "handler": "helloService.hello",
            "name": "helloService-hello",
          },
          "triggers": [
            {
              "config": {
                "methods": [
                  "GET",
                  "POST",
                  "PUT",
                  "DELETE",
                  "HEAD",
                ],
              },
              "name": "http-38245ab0e0",
              "type": "http",
            },
          ],
        },
      ]);

      expect(document.toString()).toMatchSnapshot();
    });

    it('should fill yaml with new function', function() {
      const generator = new FcGenerator('', '', '');
      const document = generator.fillYaml(new Document({
        services: {
          project1: {
            component: 'devsapp/fc',
            props: {
              region: 'cn-hangzhou',
              service: '${vars.service}',
              function: {
                name: 'helloService-hello',
              },
            }
          }
        }
      }), [
        {
          "function": {
            "handler": "helloService.hello",
            "name": "helloService-hello-other",
          },
          "triggers": [
            {
              "config": {
                "methods": [
                  "GET",
                  "POST",
                  "PUT",
                  "DELETE",
                  "HEAD",
                ],
              },
              "name": "http-38245ab0e0",
              "type": "http",
            },
          ],
        },
      ]);

      expect(document.toString()).toMatchSnapshot();
    });
  });

});
