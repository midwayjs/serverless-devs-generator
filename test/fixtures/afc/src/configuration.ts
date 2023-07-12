import { Configuration, Provide, ServerlessFunction, ServerlessTrigger, ServerlessTriggerType } from '@midwayjs/core';
import * as faas from '@midwayjs/faas';

@Configuration({
  imports: [faas]
})
export class MainConfiguration {
}

@Provide()
export class HelloService {
  @ServerlessFunction({
    handlerName: 'index.handler',
  })
  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/*',
    method: 'get'
  })
  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/hello',
    method: 'post'
  })
  @ServerlessTrigger(ServerlessTriggerType.TIMER, {
    type: 'cron',
    value: '0 0 4 * * *',
  })
  @ServerlessTrigger(ServerlessTriggerType.MQ, {
    topic: 'xxxx',
    tags: '*',
  })
  async hello(name) {
    return `hello ${name}`;
  }

  @ServerlessFunction({
    handlerName: 'index.hello',
  })
  @ServerlessTrigger(ServerlessTriggerType.MTOP)
  @ServerlessTrigger(ServerlessTriggerType.HSF)
  async hello1(name) {
    return `hello ${name}`;
  }
}
