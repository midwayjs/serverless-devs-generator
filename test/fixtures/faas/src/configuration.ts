import { Configuration, Provide, ServerlessTrigger, ServerlessTriggerType } from '@midwayjs/core';
import * as faas from '@midwayjs/faas';

@Configuration({
  imports: [faas]
})
export class MainConfiguration {
}

@Provide()
export class HelloService {
  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/*',
    method: 'get'
  })
  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/hello',
    method: 'post'
  })
  @ServerlessTrigger(ServerlessTriggerType.TIMER, {
    cronExpression: '0 0 4 * * *',
  })
  async hello(name) {
    return `hello ${name}`;
  }
}
