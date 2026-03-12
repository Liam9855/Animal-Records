const db = wx.cloud.database();

Page({
  data: {
    dogs: [],
    page: 0,
    pageSize: 20,
    isEnd: false,
    isLoading: false
  },

  onLoad: function () {
    this.getDogsList(true);
  },

  onPullDownRefresh: function() {
    this.getDogsList(true);
  },

  // ✅ 新增：触底加载更多
  onReachBottom: function() {
    this.getDogsList(false);
  },

  onShareAppMessage: function () {
    return {
      title: '汪星人基地 - 快来看看修勾们',
      path: '/pages/dogs/dogs'
    }
  },

  onShareTimeline: function () {
    return {
      title: '汪星人基地 - 快来看看修勾们'
    }
  },

  getDogsList: function(isRefresh = false) {
    if (this.data.isLoading) return;
    if (!isRefresh && this.data.isEnd) return;

    this.setData({ isLoading: true });

    if (isRefresh) {
      this.setData({ page: 0, isEnd: false });
    }

    db.collection('animals')
      .where({
        type: 'dog'
      })
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get({
        success: res => {
          const newList = res.data;
          console.log('狗狗分页数据:', newList);
          
          this.setData({
            dogs: isRefresh ? newList : this.data.dogs.concat(newList),
            page: this.data.page + 1,
            isEnd: newList.length < this.data.pageSize,
            isLoading: false
          });

          wx.stopPullDownRefresh();
        },
        fail: err => {
          console.error(err);
          this.setData({ isLoading: false });
          wx.stopPullDownRefresh();
        }
      })
  },

  goToDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
})