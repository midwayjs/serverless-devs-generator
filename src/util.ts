export function formatAggregationHandlers(handlers) {
  if (!handlers || !handlers.length) {
    return [];
  }
  return handlers
    .map(handler => {
      const { path = '', eventType } = handler;
      if (eventType !== 'http') {
        return {
          ...handler,
          level: -1,
        };
      }
      return {
        ...handler,
        method: (handler.method ? [].concat(handler.method) : []).map(
          method => {
            return method.toLowerCase();
          }
        ),
        handler: handler.handler,
        router: path.replace(/\*/g, '**'), // picomatch use **
        pureRouter: path.replace(/\**$/, ''),
        regRouter: path.replace(/\/\*$/, '/(.*)?') || '/(.*)?', // path2regexp match use (.*)?
        level: path.split('/').length - 1,
        paramsMatchLevel: path.indexOf('/:') !== -1 ? 1 : 0,
      };
    })
    .sort((handlerA, handlerB) => {
      if (handlerA.level === handlerB.level) {
        if (handlerA.level < 0) {
          return -1;
        }
        if (handlerB.pureRouter === handlerA.pureRouter) {
          return handlerA.router.length - handlerB.router.length;
        }
        if (handlerA.paramsMatchLevel === handlerB.paramsMatchLevel) {
          return handlerB.pureRouter.length - handlerA.pureRouter.length;
        }
        return handlerA.paramsMatchLevel - handlerB.paramsMatchLevel;
      }
      return handlerB.level - handlerA.level;
    });
}
