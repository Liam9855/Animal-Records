// cloudfunctions/sendUpdateMessage/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { animalId, animalName, content } = event
  
  try {
    // 1. 查找所有订阅了该动物的用户
    const subscriptions = await db.collection('subscriptions')
      .where({ animal_id: animalId })
      .get()

    if (subscriptions.data.length === 0) {
      return { success: true, message: 'No subscribers' }
    }

    // 获取当前日期，格式化为 YYYY-MM-DD
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 2. 循环发送消息
    const sendPromises = subscriptions.data.map(async sub => {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: sub._openid, // 订阅者的 openid
          page: `pages/detail/detail?id=${animalId}`, // 点击卡片跳转的页面
          lang: 'zh_CN',
          data: {
            // ✅ 更新内容 (thing3) - 限制20个字
            thing3: { 
              value: `${animalName || '小可爱'}：有人更新我的动态啦！`.substring(0, 20) 
            }, 
            
            // ✅ 更新时间 (time5)
            time5: { 
              value: dateStr 
            }, 
            
            // ✅ 备注 (phrase2)
            phrase2: { 
              value: '查看详情' 
            } 
          },
          templateId: 'aXosKL00H3RoKJ-svZujcpgBAXbH1UoRpDElTvATD1M', // 你的模板ID
          
          // ⚠️ 关键修改：改为 'formal' (正式版)
          // developer: 开发版 (有过期时间，仅开发者可访问)
          // trial: 体验版
          // formal: 正式版 (线上用户必须用这个)
          miniprogramState: 'formal' 
        })
        return { openid: sub._openid, status: 'success' }
      } catch (err) {
        console.error('发送失败', sub._openid, err)
        // 错误码 43101 表示用户拒收，可以清理数据
        if (err.errCode === 43101) {
           await db.collection('subscriptions').doc(sub._id).remove()
        }
        return { openid: sub._openid, status: 'failed', error: err }
      }
    })

    return await Promise.all(sendPromises)
  } catch (err) {
    console.error(err)
    return { success: false, err }
  }
}