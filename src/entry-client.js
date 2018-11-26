//======================================== 这个是正常的webpack 入口文件 ========================================
// 爱怎么写就怎么写 不需要返回
// 但是这里的作用主要是处理asyncData
import Vue from 'vue'
import 'es6-promise/auto'
import { createApp } from './app'
import ProgressBar from './components/ProgressBar.vue'

// global progress bar
const bar = Vue.prototype.$bar = new Vue(ProgressBar).$mount()
document.body.appendChild(bar.$el)
// https://ssr.vuejs.org/zh/guide/data.html#%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%95%B0%E6%8D%AE%E9%A2%84%E5%8F%96-client-data-fetching
// a global mixin that calls `asyncData` when a route component's params change
// 在客户端，处理数据预取有两种不同方式：
Vue.mixin({
  beforeRouteUpdate (to, from, next) { // 全局插入一个路由切换的时候 请求数据                            这里是监听同一个组件的路由变化
    const { asyncData } = this.$options
    if (asyncData) {
      asyncData({
        store: this.$store,
        route: to
      }).then(next).catch(next)
    } else {
      next()
    }
  }
})

const { app, router, store } = createApp()

// prime the store with server-initialized state.
// the state is determined during SSR and inlined in the page markup.
if (window.__INITIAL_STATE__) { // 替换当前的state  在客户端中 因为一开始服务器已经请求了
  store.replaceState(window.__INITIAL_STATE__)
}

// wait until router has resolved all async before hooks
// and async components...
router.onReady(() => {
  // Add router hook for handling asyncData.
  // Doing it after initial route is resolved so that we don't double-fetch
  // the data that we already have. Using router.beforeResolve() so that all
  // async components are resolved.
  router.beforeResolve((to, from, next) => { // 全局的路由守卫 是beforeEach的     别名                   这里是监听不同组件的路由变化  相同的就不调用 而是粗发上面的那个
    const matched = router.getMatchedComponents(to) // 获取匹配到的路由组件数组
    const prevMatched = router.getMatchedComponents(from)// 获取匹配到的路由组件数组
    let diffed = false // 没有差异
    const activated = matched.filter((c, i) => { // 对比将要跳转的路由 是否有差异
      return diffed || (diffed = (prevMatched[i] !== c)) 
    })
    const asyncDataHooks = activated.map(c => c.asyncData).filter(_ => _)
    if (!asyncDataHooks.length) {// 没有差异的话  就什么都不做
      return next()
    }

    bar.start()
    // 在SSR中  针对服务器自定义了一个asyncData的方法
    // 但是这个asyncData的方法在 客户端中没有  
    // 所以这里需要手动去调用这个方法 预先请求到数据
    // 但我觉得不应该在beforeResolve 中调用 而是在afterEach中调用
    Promise.all(asyncDataHooks.map(hook => hook({ store, route: to })))  // hook钩子 === asyncData 执行asyncData
      .then(() => {
        bar.finish()
        next() // 请求完毕所有数据后才进行路由跳转 
      })
      .catch(next)
  })    

  // actually mount to DOM
  app.$mount('#app')
})

// service worker
if ('https:' === location.protocol && navigator.serviceWorker) { // 当http协议的时候才使用service-worker
  navigator.serviceWorker.register('/service-worker.js')
}
