const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    postId: '',
    post: {},
    comments: [],
    inputValue: '',
    userInfo: null
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ postId: options.id });
      this.loadPost(options.id);
      this.loadComments(options.id);
    }
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  loadPost: function(id) {
    db.collection('timeline').doc(id).get({
      success: res => {
        const post = res.data;
        post.timeStr = this.formatTime(post.create_time);
        this.setData({ post });
      },
      fail: console.error
    });
  },

  loadComments: function(id) {
    db.collection('comments')
      .where({ post_id: id })
      .orderBy('create_time', 'desc')
      .get({
        success: res => {
          const comments = res.data.map(c => {
            c.timeStr = this.formatTime(c.create_time);
            return c;
          });
          this.setData({ comments });
        },
        fail: console.error
      });
  },

  formatTime: function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  submitComment: function() {
    if (!this.data.userInfo) {
      return wx.showToast({ title: '请先在详情页登录', icon: 'none' });
    }
    if (!this.data.inputValue) return;

    wx.showLoading({ title: '发送中...' });
    
    // 1. 写入评论
    db.collection('comments').add({
      data: {
        post_id: this.data.postId,
        content: this.data.inputValue,
        user: this.data.userInfo,
        create_time: new Date()
      },
      success: () => {
        // 2. 更新动态的评论数 (原子操作)
        const _ = db.command;
        db.collection('timeline').doc(this.data.postId).update({
          data: { comment_count: _.inc(1) }
        });

        wx.hideLoading();
        wx.showToast({ title: '评论成功' });
        this.setData({ inputValue: '' });
        this.loadComments(this.data.postId); // 刷新列表
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '评论失败', icon: 'none' });
        console.error(err);
      }
    });
  }
})