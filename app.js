App({
  globalData: {
    uploadingTasks: [] // ✅ 新增：全局存储正在上传的任务
  },
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      // ⚠️ 这里是连接云端的关键一步
      wx.cloud.init({
        // 请把你刚才复制的 ID 填在下面引号里，例如 'cat-dog-123456'
        env: 'cloud1-XXXXXX', 
        traceUser: true,
      })
    }
  }
})