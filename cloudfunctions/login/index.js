const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 精确查询：只查找 openid 等于当前访问者的数据
    const res = await db.collection('users').where({
      _openid: openid
    }).get()
    
    return {
      openid: openid,
      // 如果找到了，返回用户信息；没找到返回 null
      user: res.data.length > 0 ? res.data[0] : null
    }
  } catch (e) {
    console.error(e)
    return { error: e }
  }
}