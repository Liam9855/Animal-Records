const db = wx.cloud.database();
const _ = db.command;
const app = getApp(); 

const TEMPLATE_ID = 'aXosKL00H3RoKJ-svZujcpgBAXbH1UoRpDElTvATD1M';

Page({
  data: {
    animal: {},
    commentsList: [],
    showCommentModal: false,
    pageSize: 5,
    currentPage: 0,
    hasMore: true,
    isLoading: false,
    showReplyDetailModal: false,
    currentReplyItem: null, 
    commentContent: '',
    commentImages: [],   
    commentVideo: null, 
    userInfo: null, 
    replyTo: null, 
    replyFocus: false,            
    showCorrectionModal: false,
    correctionContent: '',
    correctionImages: [],
    contactInfo: '',
    myCommentIds: [],
    likedCommentIds: [],
    
    isSubscribed: false, 
    subscriptionId: null,
    currentAnimalId: '',
    
    totalComments: 0,
    isAdmin: false,
    
    playingVideoId: null,

    showTimeline: true 
  },

  onLoad: function (options) {
    this.loadThaiConfig();

    if (options.id) {
      this.setData({ currentAnimalId: options.id });
      this.getAnimalDetail(options.id);
      this.loadComments(true);
      this.updateTotalComments(options.id);
    }
    const myIds = wx.getStorageSync('my_comment_ids') || [];
    const likedIds = wx.getStorageSync('liked_comment_ids') || [];
    this.setData({ myCommentIds: myIds, likedCommentIds: likedIds });
    
    this.trySilentLogin().then(() => {
        this.checkSubscriptionStatus(); 
        this.checkAdminStatus(); 
        this.trySilentSubscribe();
    });
  },

  // ✅ 新增：开启分享给朋友 (自定义标题和图片)
  onShareAppMessage: function () {
    const animal = this.data.animal;
    const name = animal.nickname || '小可爱';
    const type = animal.type === 'cat' ? '猫咪' : '狗狗';
    const location = animal.location || '校园';
    
    return {
      title: `${name} - ${location}的${type}`,
      path: `/pages/detail/detail?id=${this.data.currentAnimalId}`,
      imageUrl: animal.image_url // 使用动物头像作为分享封面
    }
  },

  // ✅ 新增：开启分享到朋友圈
  onShareTimeline: function () {
    const animal = this.data.animal;
    const name = animal.nickname || '小可爱';
    
    return {
      title: `快来看看 ${name} 的最新动态`,
      query: `id=${this.data.currentAnimalId}`,
      imageUrl: animal.image_url
    }
  },

  loadThaiConfig: function() {
    db.collection('config').doc('global_settings').get({
      success: res => {
        const mode = (res.data && typeof res.data.thai_mode !== 'undefined') ? res.data.thai_mode : true;
        this.setData({ showTimeline: mode });
      },
      fail: () => {
        this.setData({ showTimeline: true });
      }
    });
  },

  checkAdminStatus: function() {
    if (!this.data.userInfo) return;
    db.collection('admins').where({
      uid: Number(this.data.userInfo.uid)
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({ isAdmin: true });
      }
    });
  },

  updateTotalComments: function(animalId) {
    const targetId = animalId || this.data.currentAnimalId || this.data.animal._id;
    if (!targetId) return;

    db.collection('animal_comments')
      .where({
        animal_id: targetId,
        root_id: null 
      })
      .count()
      .then(res => {
        this.setData({ totalComments: res.total });
      })
      .catch(console.error);
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadComments(false);
    }
  },

  trySilentLogin: function() {
    return new Promise((resolve, reject) => {
      const localUser = wx.getStorageSync('user_profile');
      if (localUser) {
        this.setData({ userInfo: localUser });
        resolve(localUser);
        return;
      }
      
      wx.cloud.callFunction({
        name: 'login',
        success: res => {
          const { user } = res.result;
          if (user) {
            console.log('[Detail] 静默登录成功:', user);
            this.setData({ userInfo: user });
            wx.setStorageSync('user_profile', user);
            resolve(user);
          } else {
            resolve(null);
          }
        },
        fail: err => {
          console.error('[Detail] 云函数调用失败', err);
          resolve(null);
        }
      });
    });
  },

  ensureLogin: function() {
    return new Promise((resolve, reject) => {
      if (this.data.userInfo) {
        return resolve(this.data.userInfo);
      }
      this.setData({ showAuthModal: true });
      this.pendingLoginResolve = resolve; 
    });
  },
  
  checkSubscriptionStatus: function() {
    const targetId = this.data.currentAnimalId || this.data.animal._id;
    if (!this.data.userInfo || !targetId) return;

    db.collection('subscriptions').where({
      animal_id: targetId,
      uid: this.data.userInfo.uid 
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          isSubscribed: true,
          subscriptionId: res.data[0]._id
        });
      } else {
        this.setData({ isSubscribed: false, subscriptionId: null });
      }
    });
  },

  trySilentSubscribe: function() {
    if (!this.data.userInfo) return; 
    const animalId = this.data.currentAnimalId || this.data.animal._id;
    if (!animalId) return;

    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: res => {
        if (res[TEMPLATE_ID] === 'accept') {
          console.log('静默订阅成功，尝试写入/更新记录');
          if (!this.data.isSubscribed) {
             this._addSubscriptionRecord(animalId);
          }
        }
      },
      fail: err => {
        console.log('静默订阅未触发:', err.errMsg);
      }
    });
  },

  _addSubscriptionRecord: function(animalId) {
      const currentUserUid = this.data.userInfo.uid;
      db.collection('subscriptions').add({
        data: {
          animal_id: animalId,
          uid: currentUserUid,
          create_time: new Date(),
        }
      }).then(dbRes => {
        console.log('订阅记录添加成功');
        this.setData({ isSubscribed: true, subscriptionId: dbRes._id });
      }).catch(console.error);
  },

  onSubscribe: function() {
    this.ensureLogin().then(() => {
      const animalId = this.data.currentAnimalId || this.data.animal._id;
      
      if (this.data.isSubscribed) {
        wx.showModal({
          title: '提示',
          content: '确定要取消订阅该动物的动态提醒吗？',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '处理中' });
              db.collection('subscriptions').doc(this.data.subscriptionId).remove()
                .then(() => {
                  wx.hideLoading();
                  this.setData({ isSubscribed: false, subscriptionId: null });
                  wx.showToast({ title: '已取消订阅', icon: 'none' });
                })
                .catch(err => {
                  wx.hideLoading();
                  console.error(err);
                  wx.showToast({ title: '操作失败', icon: 'none' });
                });
            }
          }
        });
      } 
      else {
        wx.requestSubscribeMessage({
          tmplIds: [TEMPLATE_ID], 
          success: res => {
            const status = res[TEMPLATE_ID];
            if (status === 'accept') {
              wx.showLoading({ title: '订阅中' });
              this._addSubscriptionRecord(animalId);
              wx.showToast({ title: `订阅成功`, icon: 'none', duration: 3000 });
            } else if (status === 'reject') {
              wx.showModal({
                title: '权限提示',
                content: '您之前选择了“总是拒绝”。请在设置中开启权限。',
                showCancel: false
              });
            } else {
              wx.showToast({ title: '授权未通过', icon: 'none' });
            }
          },
          fail: err => {
            if (err.errCode === 20004) {
               wx.showModal({ title: '提示', content: '请在设置中开启订阅消息主开关', showCancel: false });
            } else {
               wx.showToast({ title: '调用失败', icon: 'none' });
            }
          }
        });
      }
    });
  },

  closeAuthModal: function() { this.setData({ showAuthModal: false }); },
  onChooseAvatar: function(e) { this.setData({ authAvatar: e.detail.avatarUrl }); },
  onAuthNickNameInput: function(e) { this.setData({ authNickName: e.detail.value }); },

  generateUid: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return Number(`${year}${month}${day}${random}`);
  },

  confirmAuth: function() {
    if (!this.data.authNickName) return wx.showToast({ title: '请输入昵称', icon: 'none' });
    if (!this.data.authAvatar) return wx.showToast({ title: '请选择头像', icon: 'none' });

    wx.showLoading({ title: '登录中...' });
    const uploadPromise = (this.data.authAvatar.indexOf('cloud://') === 0) 
      ? Promise.resolve(this.data.authAvatar) 
      : new Promise((resolve, reject) => {
          const cloudPath = 'avatars/' + Date.now() + '-' + Math.floor(Math.random()*1000) + '.jpg';
          wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: this.data.authAvatar, success: res => resolve(res.fileID), fail: reject });
      });

    uploadPromise.then(fileID => {
      const avatarUrl = fileID;
      const nickName = this.data.authNickName;
      
      wx.cloud.callFunction({
          name: 'login',
          success: res => {
              const { user } = res.result;
              if (user) {
                  const oldUser = user;
                  db.collection('users').doc(oldUser._id).update({
                    data: { nickname: nickName, avatar: avatarUrl, update_time: new Date() }
                  }).then(() => {
                    const updatedUser = { ...oldUser, nickname: nickName, avatar: avatarUrl };
                    this.handleLoginSuccess(updatedUser);
                  });
              } else {
                  const newId = this.generateUid();
                  const newUser = { uid: newId, nickname: nickName, avatar: avatarUrl, create_time: new Date() };
                  db.collection('users').add({ data: newUser }).then(addRes => {
                    newUser._id = addRes._id;
                    this.handleLoginSuccess(newUser);
                  });
              }
          }
      });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  handleLoginSuccess: function(userObj) {
    wx.removeStorageSync('has_logged_out');
    wx.setStorageSync('user_profile', userObj);
    this.setData({ userInfo: userObj, showAuthModal: false });
    wx.hideLoading();
    wx.showToast({ title: '欢迎用户 ' + userObj.uid, icon: 'none' }); 
    if (this.pendingLoginResolve) {
      this.pendingLoginResolve(userObj);
      this.pendingLoginResolve = null;
    }
    this.checkSubscriptionStatus();
    this.checkAdminStatus(); 
    this.trySilentSubscribe(); 
  },

  getAnimalDetail: function(id) {
    db.collection('animals').doc(id).get({ success: res => {
      this.setData({ animal: res.data });
      this.checkSubscriptionStatus();
    }});
  },

  loadComments: function(isRefresh = false) {
    this.setData({ isLoading: true });
    let currentPage = isRefresh ? 0 : this.data.currentPage;
    if (isRefresh) { this.setData({ currentPage: 0, hasMore: true, commentsList: [] }); }
    
    const skip = currentPage * this.data.pageSize;
    const targetId = this.data.currentAnimalId || this.data.animal._id || this.options.id;

    db.collection('animal_comments')
      .where({ animal_id: targetId, root_id: null }) 
      .orderBy('create_time', 'desc')
      .skip(skip)
      .limit(this.data.pageSize)
      .get()
      .then(async res => {
        const comments = res.data;
        const uids = [...new Set(comments.map(c => c.uid).filter(u => u))];
        if (uids.length > 0) {
          try {
            const usersRes = await db.collection('users').where({ uid: _.in(uids) }).get();
            const userMap = {};
            usersRes.data.forEach(u => { userMap[u.uid] = u; });
            comments.forEach(c => {
              const user = userMap[c.uid];
              if (user) {
                c.nickname = user.nickname || '神秘用户';
                c.avatar = user.avatar || '../../images/my.png';
              } else {
                c.nickname = '神秘用户';
                c.avatar = '../../images/my.png';
              }
            });
          } catch (e) { console.error(e); }
        }

        const processedList = this.processCommentsData(comments);
        let finalList = processedList;
        if (isRefresh) {
            const pendingTasks = app.globalData.uploadingTasks.filter(t => t.animal_id === targetId);
            finalList = [...pendingTasks, ...processedList];
        } else {
            finalList = this.data.commentsList.concat(processedList);
        }

        this.setData({ commentsList: finalList });
        if (comments.length < this.data.pageSize) {
          this.setData({ hasMore: false });
        } else {
          this.setData({ currentPage: currentPage + 1 });
        }
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ isLoading: false });
      });
  },

  processCommentsData: function(list) {
    return list.map(item => {
      item.timeStr = this.formatTime(item.create_time); 
      item.isMyComment = this.data.myCommentIds.includes(item._id);
      item.replies = []; 
      item.likeCount = typeof item.likeCount === 'number' ? item.likeCount : 0;
      item.replyCount = typeof item.replyCount === 'number' ? item.replyCount : 0;
      item.isLiked = this.data.likedCommentIds.includes(item._id);
      if (!item.avatar) item.avatar = '../../images/my.png';
      return item;
    });
  },

  toggleLike: function(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.commentsList[index];
    if (item.isUploading) return;

    const isLiked = !item.isLiked;
    const newCount = isLiked ? (item.likeCount + 1) : (item.likeCount - 1);

    this.setData({
      [`commentsList[${index}].isLiked`]: isLiked,
      [`commentsList[${index}].likeCount`]: newCount
    });

    let likedIds = this.data.likedCommentIds;
    if (isLiked) {
      likedIds.push(item._id);
    } else {
      likedIds = likedIds.filter(id => id !== item._id);
    }
    this.setData({ likedCommentIds: likedIds });
    wx.setStorageSync('liked_comment_ids', likedIds);

    db.collection('animal_comments').doc(item._id).update({
      data: { likeCount: newCount }
    });
    
    wx.showToast({ title: isLiked ? '点赞成功' : '取消点赞', icon: 'none' });
  },

  openReplyDetail: function(e) {
    const item = e.currentTarget.dataset.item;
    if (item.isUploading) return;

    this.setData({
      showReplyDetailModal: true,
      currentReplyItem: item,
      commentContent: '',
      replyTo: null,
      replyFocus: false 
    });
    if (item && item._id) {
        this.loadRepliesFor(item._id);
    }
  },
  
  loadRepliesFor: function(rootId) {
    wx.showLoading({ title: '加载回复...' });
    db.collection('animal_comments').where({ root_id: rootId }).orderBy('create_time', 'asc').get({
        success: async res => {
          const replies = res.data;
          const uids = [...new Set(replies.map(r => r.uid).filter(u => u))];
          if (uids.length > 0) {
             try {
               const usersRes = await db.collection('users').where({ uid: _.in(uids) }).get();
               const userMap = {};
               usersRes.data.forEach(u => userMap[u.uid] = u);
               replies.forEach(r => {
                 const user = userMap[r.uid];
                 if (user) {
                   r.nickname = user.nickname || '神秘用户';
                   r.avatar = user.avatar || '../../images/my.png';
                 } else {
                   r.nickname = r.nickname || '神秘用户';
                   r.avatar = r.avatar || '../../images/my.png';
                 }
               });
             } catch(e) { console.error(e); }
          }

          const processedReplies = replies.map(item => {
            item.timeStr = this.formatTime(item.create_time);
            item.isMyComment = this.data.myCommentIds.includes(item._id);
            if (!item.avatar) item.avatar = '../../images/my.png';
            return item;
          });
          
          const current = this.data.currentReplyItem;
          current.replies = processedReplies;
          this.setData({ currentReplyItem: current });
          wx.hideLoading();
        },
        fail: () => wx.hideLoading()
      });
  },

  closeReplyDetail: function() { this.setData({ showReplyDetailModal: false }); },
  openCommentModal: function() { this.ensureLogin().then(() => { this.setData({ showCommentModal: true, replyTo: null, commentContent: '', commentImages: [], commentVideo: null }); }); },
  
  onReplyInDetail: function(e) {
    let item = e.currentTarget.dataset.item;
    if (!item) { item = this.data.currentReplyItem; }
    const rootItem = this.data.currentReplyItem; 
    const rootId = rootItem ? rootItem._id : ''; 
    let replyUser = item.nickname;
    this.ensureLogin().then(() => {
      this.setData({
        replyTo: { id: item._id, root_id: rootId, user: replyUser },
        replyFocus: true
      });
    });
  },

  clearReplyTo: function() { this.setData({ replyTo: null, replyFocus: true }); },
  closeCommentModal: function() { this.setData({ showCommentModal: false }); },
  
  chooseMedia: function() {
    this.doChooseImage();
    
    /* // 临时只允许图片，若要恢复视频，把下面注释解开，并注释上面一行
    if (this.data.commentImages.length > 0) { this.doChooseImage(); return; }
    wx.showActionSheet({ itemList: ['照片 (最多6张)', '视频 (1个)'], success: (res) => { if (res.tapIndex === 0) { this.doChooseImage(); } else { this.doChooseVideo(); } } });
    */
  },
  
  doChooseImage: function() {
    wx.chooseMedia({ 
      count: 6 - this.data.commentImages.length, 
      mediaType: ['image'], 
      sourceType: ['album', 'camera'], 
      sizeType: ['compressed'], 
      success: (res) => { 
        wx.showLoading({ title: '处理中...' });
        const compressTasks = res.tempFiles.map(file => {
          return new Promise(resolve => {
            wx.compressImage({ src: file.tempFilePath, quality: 50, success: (cRes) => resolve(cRes.tempFilePath), fail: () => resolve(file.tempFilePath) });
          });
        });
        Promise.all(compressTasks).then(compressedPaths => {
          this.setData({ commentImages: this.data.commentImages.concat(compressedPaths) });
          wx.hideLoading();
        }).catch(() => {
           wx.hideLoading();
           const paths = res.tempFiles.map(f => f.tempFilePath);
           this.setData({ commentImages: this.data.commentImages.concat(paths) });
        });
      } 
    });
  },
  
  doChooseVideo: function() {
    wx.chooseMedia({ 
      count: 1, 
      mediaType: ['video'], 
      sourceType: ['album', 'camera'], 
      maxDuration: 60, 
      camera: 'back', 
      success: (res) => { 
        const tempFile = res.tempFiles[0];
        wx.showLoading({ title: '视频压缩中...' });
        wx.compressVideo({
          src: tempFile.tempFilePath,
          quality: 'medium', 
          success: (cRes) => {
            wx.hideLoading();
            this.setData({ commentVideo: cRes.tempFilePath });
          },
          fail: (err) => {
            wx.hideLoading();
            if (tempFile.size > 50 * 1024 * 1024) { wx.showToast({ title: '视频文件过大', icon: 'none' }); }
            this.setData({ commentVideo: tempFile.tempFilePath });
          }
        });
      } 
    });
  },

  removeCommentImage: function(e) { const index = e.currentTarget.dataset.index; const images = this.data.commentImages; images.splice(index, 1); this.setData({ commentImages: images }); },
  removeCommentVideo: function() { this.setData({ commentVideo: null }); },

  onCommentInput: function(e) { this.setData({ commentContent: e.detail.value }); },

  submitComment: function() {
    if (!this.data.commentContent && this.data.commentImages.length === 0 && !this.data.commentVideo) {
      return wx.showToast({ title: '内容不能为空', icon: 'none' });
    }

    const currentReplyTo = this.data.replyTo;
    const inReplyDetail = this.data.showReplyDetailModal && this.data.currentReplyItem; 
    let finalRootId = currentReplyTo ? currentReplyTo.root_id : (inReplyDetail ? this.data.currentReplyItem._id : null);
    let finalReplyUser = currentReplyTo ? currentReplyTo.user : null;
    const isNewTopic = !finalRootId; 
    
    if (isNewTopic) {
        const tempId = 'temp_' + Date.now();
        const userInfo = this.data.userInfo || { nickname: '我', avatar: '../../images/my.png' }; 
        const tempItem = {
            _id: tempId,
            animal_id: this.data.currentAnimalId || this.data.animal._id,
            content: this.data.commentContent,
            images: this.data.commentImages, 
            video: this.data.commentVideo,   
            uid: userInfo.uid,
            nickname: userInfo.nickname,
            avatar: userInfo.avatar,
            create_time: new Date(),
            timeStr: '刚刚',
            likeCount: 0,
            replyCount: 0,
            isLiked: false,
            isMyComment: true,
            root_id: null,
            reply_to_user: null,
            isUploading: true, 
            uploadTasks: [] 
        };

        this.setData({
            commentsList: [tempItem, ...this.data.commentsList],
            showCommentModal: false,
            commentContent: '',
            commentImages: [],
            commentVideo: null,
            replyTo: null
        });

        app.globalData.uploadingTasks.push(tempItem);
        this._executeBackgroundUpload(tempItem);
        return; 
    }
    this._submitRealComment(true); 
  },

  cancelUpload: function(e) {
    const tempId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示', content: '确定要取消发送吗？',
      success: (res) => {
        if (res.confirm) {
          const index = app.globalData.uploadingTasks.findIndex(t => t._id === tempId);
          if (index > -1) {
            const task = app.globalData.uploadingTasks[index];
            if (task.uploadTasks && task.uploadTasks.length > 0) {
              task.uploadTasks.forEach(uploadTask => {
                if (uploadTask && typeof uploadTask.abort === 'function') uploadTask.abort();
              });
            }
            app.globalData.uploadingTasks.splice(index, 1);
          }
          const list = this.data.commentsList.filter(item => item._id !== tempId);
          this.setData({ commentsList: list });
          wx.showToast({ title: '已取消', icon: 'none' });
        }
      }
    })
  },

  _submitRealComment: function(showLoading = false) {
      if (showLoading) {
          wx.showLoading({ title: '发送中...', mask: true });
          this.closeCommentModal();
      }
      const currentReplyTo = this.data.replyTo;
      const inReplyDetail = this.data.showReplyDetailModal && this.data.currentReplyItem; 
      let finalRootId = currentReplyTo ? currentReplyTo.root_id : (inReplyDetail ? this.data.currentReplyItem._id : null);
      let finalReplyUser = currentReplyTo ? currentReplyTo.user : null;

      this._executeUploadLogic(
          this.data.commentContent, 
          this.data.commentImages, 
          this.data.commentVideo,
          finalRootId,
          finalReplyUser,
          null 
      ).then(() => {
          if (showLoading) wx.hideLoading();
          this.setData({ commentContent: '', commentImages: [], commentVideo: null, replyTo: null });
      }).catch(err => {
          if (showLoading) wx.hideLoading();
          wx.showToast({ title: '发送失败', icon: 'none' });
      });
  },

  _executeBackgroundUpload: function(tempItem) {
      this._executeUploadLogic(tempItem.content, tempItem.images, tempItem.video, null, null, tempItem)
          .then((realData) => {
              const index = app.globalData.uploadingTasks.findIndex(t => t._id === tempItem._id);
              if (index === -1) return;
              app.globalData.uploadingTasks.splice(index, 1);

              const { _id: realId } = realData;
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              if (currentPage && currentPage.route === 'pages/detail/detail') {
                  currentPage.handleUploadFinished(tempItem._id, realId, true);
              }
              
              wx.cloud.callFunction({
                  name: 'sendUpdateMessage', 
                  data: {
                    animalId: tempItem.animal_id,
                    animalName: this.data.animal.nickname, 
                    content: '[图片/视频动态]' 
                  }
               }).catch(console.error);
          })
          .catch(err => {
              if (err && err.errMsg && err.errMsg.includes('abort')) return;
              const index = app.globalData.uploadingTasks.findIndex(t => t._id === tempItem._id);
              if (index === -1) return;
              app.globalData.uploadingTasks.splice(index, 1);
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              if (currentPage && currentPage.route === 'pages/detail/detail') {
                  currentPage.handleUploadFinished(tempItem._id, null, false);
              }
          });
  },

  handleUploadFinished: function(tempId, realId, isSuccess) {
      if (isSuccess) {
          const list = this.data.commentsList.map(item => {
              if (item._id === tempId) {
                  return { ...item, _id: realId, isUploading: false };
              }
              return item;
          });
          this.setData({ commentsList: list, totalComments: this.data.totalComments + 1 });
      } else {
          const list = this.data.commentsList.filter(item => item._id !== tempId);
          this.setData({ commentsList: list });
          wx.showModal({ title: '发送失败', content: '网络异常或超时，请重试', showCancel: false });
      }
  },

  _executeUploadLogic: function(content, images, videoPath, rootId, replyUser, tempItem) {
      return new Promise((resolve, reject) => {
        const tasks = [];
        if (images.length > 0) {
          images.forEach(p => {
            tasks.push(new Promise((res, rej) => {
              const uploadTask = wx.cloud.uploadFile({ 
                cloudPath: 'comments/' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.jpg', 
                filePath: p, 
                success: r => res(r.fileID), 
                fail: rej
              });
              if (tempItem && tempItem.uploadTasks) tempItem.uploadTasks.push(uploadTask);
            }));
          });
        }
        if (videoPath) {
          tasks.push(new Promise((res, rej) => {
            const uploadTask = wx.cloud.uploadFile({ 
              cloudPath: 'comments/' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.mp4', 
              filePath: videoPath, 
              success: r => res(r.fileID), 
              fail: rej
            });
            if (tempItem && tempItem.uploadTasks) tempItem.uploadTasks.push(uploadTask);
          }));
        }

        const timeoutPromise = new Promise((_, rej) => {
          setTimeout(() => rej(new Error('上传超时')), 300000);
        });

        Promise.race([Promise.all(tasks), timeoutPromise]).then(fileIds => {
            let finalImages = [], finalVideo = '';
            if (videoPath) {
                finalVideo = fileIds[fileIds.length - 1];
                if (images.length > 0) finalImages = fileIds.slice(0, -1);
            } else { finalImages = fileIds; }

            const newComment = {
                // ✅ 关键修复：这里应该使用从参数传入的 rootId 和 replyUser
                animal_id: this.data.currentAnimalId || this.data.animal._id,
                content: content,
                images: finalImages,
                video: finalVideo,
                uid: this.data.userInfo.uid,
                create_time: new Date(),
                likeCount: 0,
                replyCount: 0,
                root_id: rootId, 
                reply_to_user: replyUser
            };

            db.collection('animal_comments').add({ data: newComment }).then(res => {
                const commentId = res._id;
                const myIds = this.data.myCommentIds;
                myIds.push(commentId);
                wx.setStorageSync('my_comment_ids', myIds);
                this.setData({ myCommentIds: myIds });

                if (rootId) {
                   db.collection('animal_comments').doc(rootId).update({ data: { replyCount: _.inc(1) } });
                   const commentsList = this.data.commentsList;
                   const parentIndex = commentsList.findIndex(c => c._id === rootId);
                   if (parentIndex !== -1) {
                     this.setData({
                       [`commentsList[${parentIndex}].replyCount`]: commentsList[parentIndex].replyCount + 1
                     });
                   }
                   if (this.data.currentReplyItem && this.data.currentReplyItem._id === rootId) {
                     this.loadRepliesFor(rootId);
                   }
                }
                resolve({ _id: commentId });
            }).catch(reject);
        }).catch(reject);
      });
  },

  deleteComment: function(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '删除', content: '确定删除这条内容吗？', success: res => {
        if (res.confirm) {
          db.collection('animal_comments').doc(item._id).remove().then(() => {
             wx.showToast({ title: '已删除' });
             if (item.root_id) {
               db.collection('animal_comments').doc(item.root_id).update({ data: { replyCount: _.inc(-1) } }).catch(console.error);
               const commentsList = this.data.commentsList;
               const parentIndex = commentsList.findIndex(c => c._id === item.root_id);
               if (parentIndex !== -1) {
                 this.setData({ [`commentsList[${parentIndex}].replyCount`]: Math.max(0, commentsList[parentIndex].replyCount - 1) });
               }
               this.loadRepliesFor(item.root_id);
             } else {
               const newList = this.data.commentsList.filter(c => c._id !== item._id);
               this.setData({ commentsList: newList, totalComments: Math.max(0, this.data.totalComments - 1) });
             }
          }).catch(err => {
            wx.showToast({ title: '删除失败，权限不足', icon: 'none' });
          });
        }
      }
    });
  },

  openCorrectionModal: function() { 
    this.ensureLogin().then(() => {
      this.setData({ showCorrectionModal: true, correctionContent: '', correctionImages: [], contactInfo: '' });
    });
  },

  closeCorrectionModal: function() { this.setData({ showCorrectionModal: false }); },
  onCorrectionInput: function(e) { this.setData({ correctionContent: e.detail.value }); },
  onContactInput: function(e) { this.setData({ contactInfo: e.detail.value }); },
  chooseCorrectionImages: function() { wx.chooseImage({ count: 6 - this.data.correctionImages.length, success: (res) => this.setData({ correctionImages: this.data.correctionImages.concat(res.tempFilePaths) }) }); },
  removeCorrectionImage: function(e) { const idx = e.currentTarget.dataset.index; const imgs = this.data.correctionImages; imgs.splice(idx, 1); this.setData({ correctionImages: imgs }); },
  
  submitCorrection: function() {
    if (!this.data.correctionContent && this.data.correctionImages.length === 0) return wx.showToast({ title: '内容不能为空', icon: 'none' });
    this.closeCorrectionModal();
    wx.showLoading({ title: '提交中...' });
    const tasks = this.data.correctionImages.map(p => new Promise((res, rej) => {
        wx.cloud.uploadFile({ cloudPath: 'corrections/' + Date.now() + Math.random() + '.jpg', filePath: p, success: r => res(r.fileID), fail: rej });
    }));
    Promise.all(tasks).then(ids => {
        db.collection('corrections').add({
            data: { 
              animal_id: this.data.currentAnimalId || this.data.animal._id, 
              animal_name: this.data.animal.nickname, 
              content: this.data.correctionContent, 
              images: ids, 
              contact_info: this.data.contactInfo, 
              create_time: new Date(), 
              status: 'pending',
              uid: this.data.userInfo ? this.data.userInfo.uid : null,
              nickname: this.data.userInfo ? this.data.userInfo.nickname : null,
              avatar: this.data.userInfo ? this.data.userInfo.avatar : null
            }
        }).then(() => { wx.hideLoading(); wx.showToast({ title: '反馈成功' }); });
    }).catch(() => wx.hideLoading());
  },

  formatTime: function(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  },
  previewImage: function(e) {
    const src = e.currentTarget.dataset.src;
    const urls = e.currentTarget.dataset.urls || [src];
    wx.previewImage({ current: src, urls: urls });
  },
  
  playFullScreen: function(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ playingVideoId: id }, () => {
        const videoContext = wx.createVideoContext(id, this);
        videoContext.requestFullScreen();
        videoContext.play();
    });
  },

  onFullScreenChange: function(e) {
    const isFullScreen = e.detail.fullScreen;
    const id = e.currentTarget.id;
    if (!isFullScreen) {
      const videoContext = wx.createVideoContext(id, this);
      videoContext.pause();
      this.setData({ playingVideoId: null });
    }
  },

  stopProp: function() {}
})