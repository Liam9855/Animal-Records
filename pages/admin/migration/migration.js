const db = wx.cloud.database();

// 恢复到之前的 4 只动物演示数据
const allAnimals = [
  {
    nickname: "大黄",
    type: "cat", 
    gender: "公",
    location: "第一食堂",
    birthday: "2021年",
    dad: "未知",
    mom: "花花(已领养)",
    friends: "小黑, 奶牛",
    bio: "第一食堂的守门员，饭点必出现。最近有点胖了，请大家控制投喂量。",
    image_url: "https://img.yzcdn.cn/vant/cat.jpeg",
    album: ["https://img.yzcdn.cn/vant/cat.jpeg", "https://img.yzcdn.cn/vant/apple-1.jpg"],
    is_neutered: true,
    is_adopted: false,
    touchable: true,
    status: "在校",
    updates: [
      { user: "张同学", content: "今天中午看到它在吃鸡腿...", time: "11-25 12:30", img: "https://img.yzcdn.cn/vant/cat.jpeg", reply_count: 5 },
      { user: "后勤王阿姨", content: "天冷了，给它在角落铺了个旧衣服。", time: "11-24 16:20", img: "", reply_count: 2 }
    ]
  },
  {
    nickname: "煤球",
    type: "cat", 
    gender: "母",
    location: "图书馆",
    birthday: "2022年",
    dad: "未知",
    mom: "未知",
    friends: "无",
    bio: "全黑色的猫咪，晚上根本找不到它。性格高冷，喜欢在图书馆台阶晒太阳。",
    image_url: "https://img.yzcdn.cn/vant/cat.jpeg", 
    album: ["https://img.yzcdn.cn/vant/cat.jpeg"],
    is_neutered: true,
    is_adopted: false,
    touchable: false,
    status: "在校",
    updates: []
  },
  {
    nickname: "旺财",
    type: "dog",
    gender: "公",
    location: "保安室",
    birthday: "2020年",
    dad: "隔壁村大黑",
    mom: "未知",
    friends: "保安大叔",
    bio: "虽然叫声很大，但从来不咬学生。是保安大叔的得力助手，负责看守大门。",
    image_url: "https://img.yzcdn.cn/vant/cat.jpeg", 
    album: ["https://img.yzcdn.cn/vant/cat.jpeg?v=1", "https://img.yzcdn.cn/vant/cat.jpeg?v=2"],
    is_neutered: true,
    is_adopted: false,
    touchable: false,
    status: "在校",
    updates: [
      { user: "保安队长", content: "最近换毛期...", time: "11-24 08:00", img: "", reply_count: 8 },
      { user: "摄影社小刘", content: "拍到了旺财睡觉的丑照...", time: "11-23 14:00", img: "https://img.yzcdn.cn/vant/apple-1.jpg", reply_count: 25 }
    ]
  },
  {
    nickname: "小白",
    type: "dog",
    gender: "母",
    location: "操场",
    birthday: "2023年",
    dad: "未知",
    mom: "未知",
    friends: "所有学生",
    bio: "非常活泼的小白狗，喜欢跟着在操场跑步的同学一起跑。",
    image_url: "https://img.yzcdn.cn/vant/cat.jpeg",
    album: ["https://img.yzcdn.cn/vant/cat.jpeg"],
    is_neutered: false,
    is_adopted: false,
    touchable: true,
    status: "在校",
    updates: []
  }
];

Page({
  migrateData: function() {
    wx.showLoading({ title: '正在重置数据...', mask: true });
    let successCount = 0;
    
    allAnimals.forEach(item => {
      db.collection('animals').add({
        data: item,
        success: res => {
          successCount++;
          if(successCount === allAnimals.length) {
            wx.hideLoading();
            wx.showModal({ title: '恢复成功', content: `已重置 ${successCount} 条基础档案。`, showCancel: false });
          }
        },
        fail: err => {
          console.error('[失败]', err);
        }
      })
    });
  }
})