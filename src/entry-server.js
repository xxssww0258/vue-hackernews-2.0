//======================================== 服务端 入口文件 ========================================
// 需要返回一个 vue 的实例
// 这里是以一个工厂函数 返回一个promise 异步resolve 返回一个vue
import { createApp } from './app'

const isDev = process.env.NODE_ENV !== 'production'

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.
export default context => { // 出口的方法 其实就是 renderer.renderToString   // renderer.renderToString(context,(err,html)=>res.send(html))
  return new Promise((resolve, reject) => {
    const s = isDev && Date.now()
    const { app, router, store } = createApp()

    const { url } = context
    const { fullPath } = router.resolve(url).route

    if (fullPath !== url) {
      return reject({ url: fullPath })
    }

    // set router's location
    router.push(url) // 路由跳转  这里的router 是刚刚创建的router 对象  所以没有指定路由位置 需要手动跳转

    // wait until router has resolved possible async hooks // 等到 router 将可能的异步组件和钩子函数解析完
    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents() // 这里没传入参数是因为push了一个路由 直接返回当前匹配到的路由
      // no matched routes  // 匹配不到的路由，执行 reject 函数，并返回 404
      if (!matchedComponents.length) {
        return reject({ code: 404 }) // 这里的reject  会返回给 renderer.renderToString 返回一个错误对象
      }
      // Call fetchData hooks on components matched by the route.
      // A preFetch hook dispatches a store action and returns a Promise,
      // which is resolved when the action is complete and store state has been
      // updated.
      Promise.all(matchedComponents.map(({ asyncData }) => asyncData && asyncData({
        store,
        route: router.currentRoute
      }))).then(() => {
        isDev && console.log(`data pre-fetch: ${Date.now() - s}ms`)
        // After all preFetch hooks are resolved, our store is now
        // filled with the state needed to render the app.
        // Expose the state on the render context, and let the request handler
        // inline the state in the HTML response. This allows the client-side
        // store to pick-up the server-side state without having to duplicate
        // the initial data fetching on the client.
        context.state = store.state   // 状态将自动序列化为 `window.__INITIAL_STATE__`，并注入 HTML。
        resolve(app)
      }).catch(reject)
    }, reject)
  })
}
