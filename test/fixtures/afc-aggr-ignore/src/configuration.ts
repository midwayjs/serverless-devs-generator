import { Configuration, Provide, ServerlessTrigger, ServerlessTriggerType, Inject } from '@midwayjs/core';
import * as faas from '@midwayjs/faas';

@Configuration({
  imports: [faas]
})
export class MainConfiguration {
}

@Provide()
export class HelloService {

  @Inject()
  ctx;  // context

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/api/*',
    method: 'get',
    handlerName: 'apiall.handler',
    functionName: 'apiall'
  })
  async apiall(event, obj = {}) {
    return 'apiall:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/api/1',
    method: 'get',
    handlerName: 'api1.handler',
    functionName: 'api1'
  })
  async api1(event, obj = {}) {
    return 'api1:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/api/2',
    method: 'get',
    handlerName: 'api2.handler',
    functionName: 'api2'
  })
  async api2(event, obj = {}) {
    return 'api2:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/api/3',
    method: 'get',
    handlerName: 'api3.handler',
    functionName: 'api3'
  })
  async api3(event, obj = {}) {
    return 'api3:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/render',
    method: 'get',
    handlerName: 'render.handler',
    functionName: 'render'
  })
  async render(event, obj = {}) {
    return 'render:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/render/1',
    method: 'get',
    handlerName: 'render1.handler',
    functionName: 'render1'
  })
  async render1(event, obj = {}) {
    return 'render1:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/render/2',
    method: 'get',
    handlerName: 'render2.handler',
    functionName: 'render2'
  })
  async render2(event, obj = {}) {
    return 'render2:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/normal/1',
    method: 'get',
    handlerName: 'normal1.handler',
    functionName: 'normal1'
  })
  async normal1(event, obj = {}) {
    return 'normal1:' + this.ctx.path;
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, {
    path: '/normal/2',
    method: 'get',
    handlerName: 'normal2.handler',
    functionName: 'normal2'
  })
  async normal2(event, obj = {}) {
    return 'normal2:' + this.ctx.path;
  }
}
