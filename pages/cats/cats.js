const db = wx.cloud.database();

Page({
  data: {
    cats: [],
    page: 0,       // 当前页码
    pageSize: 20,  // 每页数量
    isEnd: false,  // 是否已加载完所有数据
    isLoading: false // 防止重复加载
  },

  // ✅ 改为 onLoad 加载，避免 onShow 每次切换回来都刷新导致体验不好
  onLoad: function () {
    this.getCatsList(true);
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.getCatsList(true);
  },

  // ✅ 新增：触底加载更多
  onReachBottom: function() {
    this.getCatsList(false);
  },

  onShareAppMessage: function () {
    return {
      title: '喵星人基地 - 这里有超多可爱的猫猫',
      path: '/pages/cats/cats'
    }
  },

  onShareTimeline: function () {
    return {
      title: '喵星人基地 - 这里有超多可爱的猫猫'
    }
  },

  // 核心修复：支持分页加载
  getCatsList: function(isRefresh = false) {
    // 如果正在加载中，或者不是刷新且已经到底了，就不执行
    if (this.data.isLoading) return;
    if (!isRefresh && this.data.isEnd) return;

    this.setData({ isLoading: true });

    if (isRefresh) {
      // 如果是刷新，重置页码
      this.setData({ page: 0, isEnd: false });
    }

    db.collection('animals')
      .where({
        type: 'cat'
      })
      .skip(this.data.page * this.data.pageSize) // 跳过前 n 页
      .limit(this.data.pageSize) // 限制每页 20 条
      .get({
        success: res => {
          const newList = res.data;
          console.log('猫猫分页数据:', newList);

          this.setData({
            // 如果是刷新，直接覆盖；否则追加到原数组后面
            cats: isRefresh ? newList : this.data.cats.concat(newList),
            // 页码 +1
            page: this.data.page + 1,
            // 如果返回的数据少于 pageSize，说明没数据了
            isEnd: newList.length < this.data.pageSize,
            isLoading: false
          });
          
          wx.stopPullDownRefresh();
          if (isRefresh) wx.hideLoading();
        },
        fail: err => {
          console.error('猫猫获取失败', err);
          this.setData({ isLoading: false });
          wx.stopPullDownRefresh();
          wx.hideLoading();
        }
      })
  },

  goToDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
})