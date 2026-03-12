const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event
  
  if (!id) {
    return { success: false, msg: '缺少参数 id' }
  }

  try {
    // 使用云函数的超级权限，强制将数据库中的 status 字段改为 'read'
    const res = await db.collection('corrections').doc(id).update({
      data: {
        status: 'read'
      }
    })
    
    return {
      success: true,
      updated: res.stats.updated
    }
  } catch(e) {
    console.error(e)
    return {
      success: false,
      error: e
    }
  }
}