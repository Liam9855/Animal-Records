const db = wx.cloud.database();

Page({
  data: {
    detail: {},
    loading: true
  },

  onLoad: function (options) {
    if (options.id) {
      this.loadDetail(options.id);
    }
  },

  loadDetail: function(id) {
    db.collection('corrections').doc(id).get({
      success: res => {
        const data = res.data;
        data.timeFull = this.formatFullTime(data.create_time);
        
        this.setData({ 
          detail: data,
          loading: false
        });

        // 如果状态是未读(pending)，则调用云函数标记为已读
        if (data.status === 'pending') {
          this.markAsRead(id);
        }
      },
      fail: err => {
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  // ✅ 核心修复：调用刚才创建的 markCorrectionRead 云函数
  markAsRead: function(id) {
    console.log('正在请求云函数标记已读...', id);
    
    wx.cloud.callFunction({
      name: 'markCorrectionRead', // 调用新创建的云函数
      data: { id: id },
      success: res => {
        console.log('标记已读成功', res);
        
        // 1. 更新当前页面显示的标签状态
        this.setData({ 'detail.status': 'read' });
        
        // 2. 主动找到上一页（收件箱列表），把对应的那一条数据也改成已读
        // 这样当你点返回的时候，列表里的蓝点就会消失了
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        // 确保上一页确实是反馈列表页
        if (prevPage && prevPage.route.indexOf('feedback/feedback') > -1) {
          const list = prevPage.data.corrections;
          // 在列表中找到当前这条信件
          const targetIndex = list.findIndex(item => item._id === id);
          if (targetIndex > -1) {
            // 直接修改上一页的数据
            const key = `corrections[${targetIndex}].status`;
            prevPage.setData({ [key]: 'read' });
          }
        }
      },
      fail: err => {
        console.error('云函数调用失败', err);
      }
    });
  },

  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    const urls = this.data.detail.images;
    wx.previewImage({ current, urls });
  },

  deleteFeedback: function() {
    wx.showModal({
      title: '删除确认',
      content: '确定要删除这条反馈信息吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          // 尝试删除
          db.collection('corrections').doc(this.data.detail._id).remove({
            success: () => {
              wx.hideLoading();
              
              // 删除成功后，也要同步更新上一页列表，把这条移除掉
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage && prevPage.route.indexOf('feedback/feedback') > -1) {
                 const list = prevPage.data.corrections.filter(item => item._id !== this.data.detail._id);
                 prevPage.setData({ corrections: list });
              }

              wx.navigateBack();
            },
            fail: (err) => {
              wx.hideLoading();
              console.error(err);
              // 如果删除也提示权限不足，也需要类似地创建一个云函数来处理删除，但目前先只解决“已读”问题
              wx.showToast({ title: '删除失败(权限不足)', icon: 'none' });
            }
          });
        }
      }
    });
  },

  formatFullTime: function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
})