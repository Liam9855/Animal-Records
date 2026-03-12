<img width="603" height="1311" alt="IMG_7418" src="https://github.com/user-attachments/assets/35a14f7e-d541-4847-800c-12af473424e5" /># Animal-Records
这是一个开源的校园动物档案记录的微信小程序，可以展示校园的猫和狗的档案，用户可以进行动物动态的反馈、评论、动态订阅等互动。下图为使用实例
![IMG_7418](https://github.com/user-attachments/assets/58761b78-e301-42dc-843d-f4734eca1a07)
![IMG_7419](https://github.com/user-attachments/assets/a0c3a4fa-2569-4974-b387-7746382a5f21)
![IMG_7420](https://github.com/user-attachments/assets/818d98a7-b37f-43a8-9937-1d6745593b5d)
//////////
源码教程：
（1）开发和使用环境基于微信开发者工具以及自带的云数据库
（2）替换project.config.json里的APPID为你自己的小程序开发ID，替换sendUpdateMessage/index.js里的消息推送模板id为你自己的
（3）管理界面也集成在主程序里，把管理员的UID填写到数据库admin表单里即可开启该UID用户的管理权限，开启后在“我的”界面即可看到“进入管理后台”按钮
（4）由于政策原因，个人小程序无法携带评论功能提交审核，所以管理后台有一个“Thai”功能开关按钮，关闭他即可隐藏评论功能去提交小程序审核，审核通过发布后可打开该功能按钮，即可展示评论区功能（注意低调使用，被举报或高调展示有概率被官方封号。）
//////////
云数据库结构：
admins【所有用户可读、仅创建者可读写】（"_id"/"_name"/"uid"）
animal_comments【自定义规则{
  "read": "auth != null",
  "write": "auth != null"
}()】
animals【所有用户可读、仅创建者可读写】
config【所有用户可读、仅创建者可读写】
corrections【所有用户可读、仅创建者可读写】
subscriptions【所有用户可读、仅创建者可读写】
users【所有用户可读、仅创建者可读写】
//////////
云存储结构：
animals
avatars
comments
corrections
