const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    userInfo: null,
    avatarUrl: '',
    nickName: '',
    showAuthModal: false,
    authAvatar: '',
    authNickName: '',
    isAdmin: false 
  },

  onShow: function() {
    this.checkLoginStatus();
  },

  checkLoginStatus: function(e) {
    const isUserTap = (e && e.type === 'tap'); 
    const localUser = wx.getStorageSync('user_profile');
    const hasLoggedOut = wx.getStorageSync('has_logged_out');

    if (localUser) {
      if (hasLoggedOut) wx.removeStorageSync('has_logged_out');

      this.setData({ 
        userInfo: localUser,
        avatarUrl: localUser.avatar,
        nickName: localUser.nickname,
        showAuthModal: false 
      });
      
      this.syncUserData(localUser._id);
      this.checkAdminStatus(localUser.uid); 
      return; 
    }

    if (!isUserTap && hasLoggedOut) {
      return;
    }

    if (isUserTap) wx.showLoading({ title: '检查中...' });

    // ✅ 核心修复：使用云函数 login 精确获取当前用户数据
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        if (isUserTap) wx.hideLoading();
        const { user } = res.result;

        if (user) {
          this.handleLoginSuccess(user);
        } else {
          // 没注册过
          if (isUserTap) {
            this.setData({ showAuthModal: true });
          }
        }
      },
      fail: err => {
        if (isUserTap) wx.hideLoading();
        console.error('[Profile] 云函数调用失败', err);
        if (isUserTap) this.setData({ showAuthModal: true });
      }
    });
  },

  syncUserData: function(uid) {
    db.collection('users').doc(uid).get().then(res => {
      const latestUser = res.data;
      if (latestUser.avatar !== this.data.userInfo.avatar || latestUser.nickname !== this.data.userInfo.nickname) {
        this.setData({
          userInfo: latestUser,
          avatarUrl: latestUser.avatar,
          nickName: latestUser.nickname
        });
        wx.setStorageSync('user_profile', latestUser);
      }
    }).catch(err => console.error('同步失败', err));
  },

  checkAdminStatus: function(uid) {
    if (!uid) return;
    db.collection('admins').where({
      uid: Number(uid) 
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({ isAdmin: true });
      } else {
        this.setData({ isAdmin: false });
      }
    }).catch(err => {
      this.setData({ isAdmin: false });
    });
  },

  goToAdminPanel: function() {
    wx.navigateTo({ url: '/pages/admin/manager/manager' });
  },

  onChooseNewAvatar: function(e) { 
    const tempUrl = e.detail.avatarUrl;
    this.setData({ avatarUrl: tempUrl }); 
    this.updateUserInfoToCloud('avatar', tempUrl);
  },

  onEditNickname: function() {
    wx.showModal({
      title: '修改昵称',
      content: this.data.nickName,
      editable: true,
      placeholderText: '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          const newName = res.content.trim();
          if (!newName) return wx.showToast({ title: '昵称不能为空', icon: 'none' });
          this.setData({ nickName: newName });
          this.updateUserInfoToCloud('nickname', newName);
        }
      }
    });
  },

  updateUserInfoToCloud: function(field, value) {
    if (!this.data.userInfo) return;
    wx.showLoading({ title: '更新中...' });

    let processPromise;
    if (field === 'avatar' && value.indexOf('cloud://') !== 0) {
      processPromise = new Promise((resolve, reject) => {
        const cloudPath = 'avatars/' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.jpg';
        wx.cloud.uploadFile({ cloudPath, filePath: value, success: res => resolve(res.fileID), fail: reject });
      });
    } else {
      processPromise = Promise.resolve(value);
    }

    processPromise.then(finalValue => {
      const updateData = { [field]: finalValue, update_time: new Date() };
      db.collection('users').doc(this.data.userInfo._id).update({
        data: updateData
      }).then(() => {
        const newUser = { ...this.data.userInfo, ...updateData };
        if (field === 'avatar') newUser.avatar = finalValue;
        
        this.setData({ userInfo: newUser });
        wx.setStorageSync('user_profile', newUser);
        wx.hideLoading();
        wx.showToast({ title: '更新成功', icon: 'success' });
      }).catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    });
  },

  generateUid: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return Number(`${year}${month}${day}${random}`);
  },

  closeAuthModal: function() { 
    this.setData({ showAuthModal: false }); 
  },
  
  onChooseAuthAvatar: function(e) { this.setData({ authAvatar: e.detail.avatarUrl }); },
  onAuthNickNameInput: function(e) { this.setData({ authNickName: e.detail.value }); },

  confirmAuth: function() {
    if (!this.data.authNickName) return wx.showToast({ title: '请输入昵称', icon: 'none' });
    if (!this.data.authAvatar) return wx.showToast({ title: '请选择头像', icon: 'none' });

    wx.showLoading({ title: '注册中...' });

    const uploadPromise = (this.data.authAvatar.indexOf('cloud://') === 0) 
      ? Promise.resolve(this.data.authAvatar) 
      : new Promise((resolve, reject) => {
          const cloudPath = 'avatars/' + Date.now() + '-' + Math.floor(Math.random()*1000) + '.jpg';
          wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: this.data.authAvatar, success: res => resolve(res.fileID), fail: reject });
      });

    uploadPromise.then(fileID => {
      const avatarUrl = fileID;
      const nickName = this.data.authNickName;
      
      // 注册前也需要确认是否真的不存在
      wx.cloud.callFunction({
          name: 'login',
          success: res => {
              const { user } = res.result;
              if (user) {
                  // 极其罕见：刚刚还没，现在有了
                  const oldUser = user;
                  db.collection('users').doc(oldUser._id).update({
                    data: { nickname: nickName, avatar: avatarUrl, update_time: new Date() }
                  }).then(() => {
                    const updatedUser = { ...oldUser, nickname: nickName, avatar: avatarUrl };
                    this.handleLoginSuccess(updatedUser);
                  });
              } else {
                  // 正常注册
                  const newId = this.generateUid();
                  const newUser = {
                    uid: newId,
                    nickname: nickName,
                    avatar: avatarUrl,
                    create_time: new Date()
                  };
                  db.collection('users').add({ data: newUser }).then(addRes => {
                    newUser._id = addRes._id;
                    this.handleLoginSuccess(newUser);
                  });
              }
          }
      });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    });
  },

  handleLoginSuccess: function(userObj) {
    wx.removeStorageSync('has_logged_out');
    
    wx.setStorageSync('user_profile', userObj);
    this.setData({ 
      userInfo: userObj, 
      showAuthModal: false, 
      avatarUrl: userObj.avatar,
      nickName: userObj.nickname
    });
    wx.hideLoading();
    wx.showToast({ title: '欢迎用户 ' + userObj.uid, icon: 'none' });
    
    this.checkAdminStatus(userObj.uid);
  },
  
  logout: function() {
    wx.showModal({
      title: '提示', content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          wx.removeStorageSync('user_profile');
          wx.setStorageSync('has_logged_out', true);

          this.setData({ 
            userInfo: null, 
            avatarUrl: '', 
            nickName: '',
            isAdmin: false 
          });
          // 退出后不再自动 check
        }
      }
    });
  }
})