const db = wx.cloud.database();

Page({
  data: {
    isEdit: false,
    id: '',
    formData: {
      nickname: '',
      type: 'cat',
      gender: '公',
      status: '在校',
      location: '',
      birthday: '',
      image_url: '',
      album: [], 
      is_neutered: false,
      is_adopted: false,
      touchable: true,
      bio: '',
      // ✅ 新增：家族关系字段初始化
      dad: '',
      mom: '',
      friends: ''
    },
    types: ['cat', 'dog'],
    typeLabels: ['猫', '狗'],
    genders: ['公', '母'],
    
    // 拖拽排序相关
    isDragging: false,
    dragIndex: -1,
    dragImg: '',
    dragX: 0, 
    dragY: 0,
    itemRects: []
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ isEdit: true, id: options.id });
      this.loadAnimalData(options.id);
    }
  },

  loadAnimalData: function(id) {
    wx.showLoading({ title: '加载资料...' });
    db.collection('animals').doc(id).get({
      success: res => {
        const data = res.data;
        if (!data.album) data.album = [];
        if (data.image_url && data.album.length === 0) {
          data.album.push(data.image_url);
        }
        this.setData({ formData: data });
        wx.hideLoading();
      },
      fail: err => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  onInput: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onSwitch: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onTypeChange: function(e) {
    this.setData({ 'formData.type': this.data.types[e.detail.value] });
  },
  
  onGenderChange: function(e) {
    this.setData({ 'formData.gender': this.data.genders[e.detail.value] });
  },

  // ✅ 修改：上传头像增加压缩逻辑
  uploadImage: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: chooseResult => {
        wx.showLoading({ title: '处理中...' });
        const filePath = chooseResult.tempFilePaths[0];
        
        // 压缩图片
        wx.compressImage({
          src: filePath,
          quality: 50,
          success: (cRes) => {
            this.uploadFileToCloud(cRes.tempFilePath, fileID => {
              this.setData({ 'formData.image_url': fileID });
            });
          },
          fail: (err) => {
            console.error('压缩失败，尝试原图上传', err);
            this.uploadFileToCloud(filePath, fileID => {
              this.setData({ 'formData.image_url': fileID });
            });
          }
        });
      }
    });
  },

  // ✅ 修改：上传相册增加压缩逻辑
  uploadAlbumParams: function() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      success: chooseResult => {
        wx.showLoading({ title: '处理中...' });
        
        // 1. 先对所有图片进行并发压缩
        const compressTasks = chooseResult.tempFilePaths.map(path => {
          return new Promise(resolve => {
            wx.compressImage({
              src: path,
              quality: 50,
              success: (cRes) => resolve(cRes.tempFilePath),
              fail: () => resolve(path) // 失败则用原图
            });
          });
        });

        // 2. 压缩完成后再上传
        Promise.all(compressTasks).then(compressedPaths => {
          wx.showLoading({ title: '上传中...' });
          const uploadTasks = compressedPaths.map(path => {
            return new Promise((resolve, reject) => {
              this.uploadFileToCloud(path, resolve, reject);
            });
          });

          return Promise.all(uploadTasks);
        }).then(fileIDs => {
          const newAlbum = this.data.formData.album.concat(fileIDs);
          this.setData({ 'formData.album': newAlbum });
          wx.hideLoading();
        }).catch(err => {
          console.error(err);
          wx.hideLoading();
          wx.showToast({ title: '上传出错', icon: 'none' });
        });
      }
    });
  },

  uploadFileToCloud(filePath, onSuccess, onFail) {
    if (!onFail) onFail = () => {};
    // 注意：这里不需要再 showLoading 了，因为调用者已经处理了 loading 状态，或者为了避免闪烁
    // wx.showLoading({ title: '上传中...' }); 
    
    // 获取文件扩展名，默认为 .jpg
    const match = filePath.match(/\.[^.]+?$/);
    const ext = match ? match[0] : '.jpg';
    
    const cloudPath = 'animals/' + Date.now() + '-' + Math.floor(Math.random()*1000) + ext;
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => {
        // wx.hideLoading(); // 交给调用者统一隐藏
        if (onSuccess) onSuccess(res.fileID);
      },
      fail: e => {
        // wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
        if (onFail) onFail(e);
      }
    });
  },

  deleteImg: function(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要移除这张照片吗？',
      success: (res) => {
        if (res.confirm) {
          const album = this.data.formData.album;
          album.splice(index, 1);
          this.setData({ 'formData.album': album });
        }
      }
    });
  },

  handleLongPress: function(e) {
    const index = e.currentTarget.dataset.index;
    const touch = e.touches[0];
    this.createSelectorQuery().selectAll('.album-item').boundingClientRect(rects => {
      this.setData({
        itemRects: rects,
        isDragging: true,
        dragIndex: index,
        dragImg: this.data.formData.album[index],
        dragX: touch.clientX - 30, 
        dragY: touch.clientY - 30
      });
      wx.vibrateShort();
    }).exec();
  },

  handleTouchMove: function(e) {
    if (!this.data.isDragging) return;
    const touch = e.touches[0];
    this.setData({
      dragX: touch.clientX - 30,
      dragY: touch.clientY - 30
    });
  },

  handleTouchEnd: function(e) {
    if (!this.data.isDragging) return;
    const touch = e.changedTouches[0];
    const targetIndex = this.calculateTargetIndex(touch.clientX, touch.clientY);
    if (targetIndex !== -1 && targetIndex !== this.data.dragIndex) {
      const album = this.data.formData.album;
      const item = album.splice(this.data.dragIndex, 1)[0];
      album.splice(targetIndex, 0, item);
      this.setData({ 'formData.album': album });
    }
    this.setData({ isDragging: false, dragIndex: -1 });
  },

  calculateTargetIndex(x, y) {
    const rects = this.data.itemRects;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return i;
      }
    }
    return -1;
  },

  submit: function() {
    const dataToSave = { ...this.data.formData };
    delete dataToSave._id;
    delete dataToSave._openid;

    if (!dataToSave.nickname) {
      return wx.showToast({ title: '名字不能为空', icon: 'none' });
    }

    if (!dataToSave.album) dataToSave.album = [];
    if (dataToSave.album.length === 0 && dataToSave.image_url) {
      dataToSave.album.push(dataToSave.image_url);
    }

    wx.showLoading({ title: '正在保存...' });

    if (this.data.isEdit) {
      db.collection('animals').doc(this.data.id).update({
        data: dataToSave,
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '更新成功' });
          setTimeout(() => wx.navigateBack(), 1500);
        },
        fail: err => {
          console.error('更新失败', err);
          wx.hideLoading();
          wx.showModal({ title: '保存失败', content: err.errMsg, showCancel: false });
        }
      });
    } else {
      dataToSave.updates = [];
      dataToSave.create_time = new Date();

      db.collection('animals').add({
        data: dataToSave,
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '创建成功' });
          setTimeout(() => wx.navigateBack(), 1500);
        },
        fail: err => {
          console.error('创建失败', err);
          wx.hideLoading();
          wx.showModal({ title: '保存失败', content: err.errMsg, showCancel: false });
        }
      });
    }
  }
})