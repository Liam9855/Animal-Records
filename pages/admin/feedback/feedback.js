const db = wx.cloud.database();

Page({
  data: {
    animalId: '',
    animalName: '',
    corrections: []
  },

  onLoad: function (options) {
    this.setData({
      animalId: options.id,
      animalName: options.name
    });
    wx.setNavigationBarTitle({ title: '收件箱' });
    this.loadCorrections(); // onLoad 加载一次
  },

  onShow: function () {
    // onShow 不再强制刷新，依赖详情页的主动更新，体验更流畅
    // 只有当列表为空时（可能是第一次进入或被清空），才尝试加载
    if (this.data.corrections.length === 0) {
       this.loadCorrections();
    }
  },

  // ✅ 核心升级：支持超过20条数据的全量拉取
  loadCorrections: async function() {
    wx.showLoading({ title: '收取中...' });
    
    try {
      const MAX_LIMIT = 20;
      const countResult = await db.collection('corrections').where({ animal_id: this.data.animalId }).count();
      const total = countResult.total;
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      
      const tasks = [];
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('corrections')
          .where({ animal_id: this.data.animalId })
          .orderBy('create_time', 'desc')
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
        tasks.push(promise);
      }
      
      const results = await Promise.all(tasks);
      let list = [];
      results.forEach(res => {
        list = list.concat(res.data);
      });

      // 格式化时间
      list = list.map(item => {
        item.timeStr = this.formatTime(item.create_time);
        return item;
      });

      this.setData({ corrections: list });
      wx.hideLoading();

    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '收取失败', icon: 'none' });
    }
  },

  goToDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/feedback_detail/feedback_detail?id=${id}`
    });
  },

  formatTime: function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
})