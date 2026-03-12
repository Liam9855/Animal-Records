const db = wx.cloud.database();

Page({
  data: {
    animals: [],
    appName: 'Demo' // 默认名字
  },

  onLoad: function () {
    // 首次加载
    this.loadAnimalsData();
    this.loadSystemSettings(); // ✅ 加载系统名字
  },
  
  onShow: function() {
    // 每次显示都刷新配置，确保改名后返回首页立即生效
    this.loadSystemSettings();

    // ✅ 修改：每次显示页面都重新加载所有数据，以确保后台更新（如改名、换图）能立即生效
    this.loadAnimalsData();
  },

  // ✅ 新增：加载系统设置（名字）
  loadSystemSettings: function() {
    db.collection('config').doc('global_settings').get({
      success: res => {
        if (res.data && res.data.app_name) {
          const name = res.data.app_name;
          
          // 1. 更新页面数据（用于中间星球显示）
          this.setData({ appName: name });
          
          // 2. 动态设置顶部导航栏标题
          wx.setNavigationBarTitle({ title: name });
        }
      },
      fail: () => {
        // 如果数据库没配置，保持默认
        console.log('未配置系统名，使用默认');
      }
    });
  },

  onPullDownRefresh: function() {
    this.loadAnimalsData();
    this.loadSystemSettings(); // 下拉刷新也同步名字
  },

  // ✅ 新增：开启分享给朋友
  onShareAppMessage: function () {
    return {
      title: '西那瓦爪印 - 守护校园小可爱',
      path: '/pages/index/index'
    }
  },

  // ✅ 新增：开启分享到朋友圈
  onShareTimeline: function () {
    return {
      title: 'Demo - 守护校园小可爱'
    }
  },

  // 加载动物基础数据
  loadAnimalsData: function() {
    // 注意：这里默认 get() 最多获取 20 条数据。
    // 如果你的动物总数远超 20 且希望所有动物都有机会随机展示，
    // 建议后续参考 manager.js 里的逻辑改为循环获取所有数据后再打乱。
    // 目前为了不影响性能，保持默认获取逻辑，但在前端做随机处理。
    db.collection('animals').get({
      success: res => {
        let allAnimals = res.data;

        // —————— 优化开始 ——————

        // 1. 随机打乱数组 (Fisher-Yates Shuffle 算法)
        // 这样每次刷新，动物的顺序都不一样，新老动物都有机会出现在中间
        for (let i = allAnimals.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allAnimals[i], allAnimals[j]] = [allAnimals[j], allAnimals[i]];
        }

        // 2. 限制展示数量，防止轨道过多超出屏幕
        // 这里设置为只展示前 9 个，配合上面的随机算法，每次展示的 9 个都不一样
        const displayAnimals = allAnimals.slice(0, 15);

        const processedData = displayAnimals.map((item, index) => {
          // 3. 调整间距，稍微集中一些
          // 原来: 140 + (index * 55) -> 最大半径约 140 + 1000 = 超出屏幕
          // 修改后: 100 + (index * 32) -> 更加紧凑，起始圈更小
          const fixedRadius = 100 + (index * 32); 
          
          // 速度也稍微调整，让内圈快一点，外圈慢一点，错落有致
          const fixedSpeed = 15 + (index * 5); 
          const randomDelay = -(Math.random() * fixedSpeed);

          return {
            ...item,
            orbit_radius: fixedRadius,
            speed: fixedSpeed,
            anim_delay: randomDelay,
            unreadCount: 0 // 初始化为0
          };
        });

        // —————— 优化结束 ——————

        this.setData({ animals: processedData }, () => {
          // 数据加载完后，立即计算未读数
          this.refreshUnreadCounts();
        });
        wx.stopPullDownRefresh();
      },
      fail: err => {
        console.error('首页数据加载失败', err);
        wx.stopPullDownRefresh();
      }
    })
  },

  // 🔄 刷新所有动物的未读数
  refreshUnreadCounts: async function() {
    const animals = this.data.animals;
    const newAnimals = [...animals];

    // 使用 Promise.all 并行查询每只动物的动态数
    const tasks = newAnimals.map(async (animal, index) => {
      try {
        // 1. 查询该动物的“主贴”总数 (root_id: null)
        const countResult = await db.collection('animal_comments')
          .where({
            animal_id: animal._id,
            root_id: null // 只算主贴，不算回复
          })
          .count();
        
        const currentTotal = countResult.total;
        
        // 2. 读取本地缓存：上次看过的数量
        // 缓存 Key 格式: read_count_{animalId}
        const lastReadCount = wx.getStorageSync(`read_count_${animal._id}`) || 0;
        
        // 3. 计算未读数
        let unread = currentTotal - lastReadCount;
        if (unread < 0) unread = 0; // 防止异常

        // 把 currentTotal 临时存到对象里，方便点击时更新缓存
        newAnimals[index].currentTotalPosts = currentTotal;
        newAnimals[index].unreadCount = unread;
        
      } catch (e) {
        console.error(e);
      }
    });

    await Promise.all(tasks);
    this.setData({ animals: newAnimals });
  },

  goToDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.animals.findIndex(a => a._id === id);
    
    // ✅ 点击时，将当前总数写入缓存，视为“已读所有”
    if (index !== -1) {
      const animal = this.data.animals[index];
      // 如果 currentTotalPosts 还没加载出来，就暂不更新，避免覆盖错
      if (typeof animal.currentTotalPosts === 'number') {
        wx.setStorageSync(`read_count_${id}`, animal.currentTotalPosts);
        
        // 乐观更新：点击后红点立即消失
        this.setData({
          [`animals[${index}].unreadCount`]: 0
        });
      }
    }

    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  goToAdmin: function() {
    wx.navigateTo({ url: '/pages/admin/manager/manager' });
  }
})