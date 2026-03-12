const db = wx.cloud.database();

Page({
  data: {
    animals: [],
    thaiMode: true 
  },

  onShow: function () {
    this.loadData();
    this.loadThaiConfig(); 
  },


  loadThaiConfig: function() {
    db.collection('config').doc('global_settings').get({
      success: res => {
        if (res.data && typeof res.data.thai_mode !== 'undefined') {
          this.setData({ thaiMode: res.data.thai_mode });
        }
      },
      fail: err => {
        // 如果不存在，默认是 true，也可以选择初始化一条
        console.log('配置未找到，默认开启');
      }
    });
  },


  onThaiSwitchChange: function(e) {
    const val = e.detail.value;
    this.setData({ thaiMode: val });
    

    db.collection('config').doc('global_settings').set({
      data: {
        thai_mode: val
      },
      success: () => {
        wx.showToast({ title: val ? 'kaikai' : 'yicang', icon: 'none' });
      },
      fail: err => {
        console.error(err);
        wx.showToast({ title: '设置失败', icon: 'none' });
   
        this.setData({ thaiMode: !val });
      }
    });
  },

  loadData: async function() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // —————— 修复开始：突破20条限制的逻辑 ——————
      
      // 1. 先查询集合里的总数
      const countResult = await db.collection('animals').count();
      const total = countResult.total;
      
      // 2. 计算需要分几次取 (小程序端一次最多取 20 条)
      const MAX_LIMIT = 20;
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      
      const tasks = [];
      // 3. 循环创建请求任务
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('animals')
          .skip(i * MAX_LIMIT) // 跳过前 n * 20 条
          .limit(MAX_LIMIT)    // 每次取 20 条
          .get();
        tasks.push(promise);
      }
      
      // 4. 并行执行所有请求，等待结果
      const results = await Promise.all(tasks);
      
      // 5. 将所有批次的数据拼接到一起
      let animals = [];
      results.forEach(res => {
        animals = animals.concat(res.data);
      });
      
      // —————— 修复结束 ——————

      // —————— 修复红点计数 BUG：Corrections 表同样需要突破20条限制 ——————
      // 之前只取了前20条 pending，如果未读消息很多，会导致计数不准
      const pCountRes = await db.collection('corrections').where({ status: 'pending' }).count();
      const pTotal = pCountRes.total;
      const pBatchTimes = Math.ceil(pTotal / MAX_LIMIT);
      
      const pTasks = [];
      for (let j = 0; j < pBatchTimes; j++) {
        const pPromise = db.collection('corrections')
          .where({ status: 'pending' })
          .skip(j * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
        pTasks.push(pPromise);
      }
      
      const pResults = await Promise.all(pTasks);
      let pendingList = [];
      pResults.forEach(res => {
        pendingList = pendingList.concat(res.data);
      });
      // ——————————————————————————————————————————————————

      animals.forEach(animal => {
        const count = pendingList.filter(p => p.animal_id === animal._id).length;
        animal.unreadCount = count;
      });

      this.setData({ animals: animals });
      wx.hideLoading();

    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goToAdd: function() {
    wx.navigateTo({ url: '/pages/admin/editor/editor' });
  },

  goToEdit: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/editor/editor?id=' + id });
  },

  goToFeedback: function(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: `/pages/admin/feedback/feedback?id=${id}&name=${name}` });
  },

  goHome: function() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  deleteItem: function(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 "${name}" 的档案吗？此操作不可恢复。`,
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          db.collection('animals').doc(id).remove({
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadData();
            },
            fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  }
})