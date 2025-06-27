import plugin from '../../lib/plugins/plugin.js';

export default class NikkeGameInfo extends plugin {
  constructor() {
    super({
      name: 'Nikke游戏信息查询',
      dsc: '完全修复参数错误的Nikke查询插件',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?nikke角色信息\\s+(\\w+)\\s+(.*?)$',
          fnc: 'getRoleInfo', // 用于查询 GetSavedRoleInfo，对应账号保存的“角色名”
          permission: ''
        },
        {
          reg: '^#?nikke角色列表\\s+(\\w+)$',
          fnc: 'getRoleList', // 用于查询 GetUserCharacters，对应角色代码列表
          permission: ''
        },
        {
          reg: '^#?nikke账号信息$',
          fnc: 'getUserInfo', // 用于查询 GetUserInfoNew
          permission: ''
        },
        {
          reg: '^#?nikke详细角色信息\\s+(\\w+)\\s+(\\d+)$', // 新增规则：服务器 + 角色代码 (数字)
          fnc: 'getCharacterDetails', // 新增功能：查询GetUserCharacterDetails
          permission: ''
        }
      ]
    });

    // !!重要!! 确保这里的 Cookie 是你在浏览器中抓取到的最新、最完整的 Cookie 字符串
    this.fixedCookie = 'OptanonAlertBoxClosed=2025-06-27T04:52:00.435Z; game_login_game=0; game_openid=14134239385607042872; game_channelid=131; game_gameid=29080; game_adult_status=1; game_user_name=Player_5NOZntli; game_uid=5444203170254619; game_token=ecd0a5e15d5e942cfc0f116dfc8fa5e501c490e1; OptanonConsent=isGpcEnabled=0&datestamp=Fri+Jun+27+2025+16%3A09%3A54+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202409.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=2794e839-23d6-4f3f-aa0d-90234c55d755&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0004%3A1&intType=1&geolocation=HK%3B&AwaitingReconsent=false';
    
    this.baseConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.fixedCookie,
        'X-Channel-Type': '2',
        'X-Language': 'en',
        'Origin': 'https://www.blablalink.com',
        'Referer': 'https://www.blablalink.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      }
    };

    // 服务器名称到数字ID的映射 (根据你提供的 "nikke_area_id: 81" 推断)
    this.areaIdMapToNumeric = {
      'global': 81,
      'jp': 81,
      'kr': 81, 
      'tw': 81, 
      'cn': 81  
    };

    // 角色代码到名称的映射 (这是一个示例，你需要手动补充完整的映射)
    // 可以从游戏数据站、wiki或游戏内自行整理
    this.characterNameMap = {
      1001: "拉毗",
      1002: "尼恩",
      1003: "阿妮斯",
      3001: "红莲",
      5020: "丽塔",
      5077: "爱丽丝",
      // ... 更多角色代码和名称的映射
    };
  }

  async apiRequest(url, options = {}) {
    try {
      const gameOpenIdMatch = this.fixedCookie.match(/game_openid=([^;]+)/);
      const intlOpenId = gameOpenIdMatch ? gameOpenIdMatch[1] : '';

      const fetchOptions = {
        ...this.baseConfig,
        ...options,
        headers: {
          ...this.baseConfig.headers,
          ...options.headers,
          'X-Common-Params': JSON.stringify({
            game_id: '16',
            area_id: options.commonParamsAreaId || 'global', 
            source: 'iOS',
            intl_game_id: '29080',
            language: 'en',
            env: 'prod',
            data_statistics_scene: 'outer',
            data_statistics_page_id: options.dataStatisticsPageId || 'https://www.blablalink.com/shiftyspad', // 根据需要动态设置
            data_statistics_client_type: 'iOS',
            data_statistics_lang: 'en'
          })
        }
      };
      
      // 对于 POST 请求，将 intl_open_id 注入到请求体中
      if (options.method === 'POST' && intlOpenId && options.body) {
        let bodyObj = JSON.parse(options.body);
        if (typeof bodyObj === 'object' && bodyObj !== null) { // 确保是对象才能添加属性
          bodyObj.intl_open_id = intlOpenId;
        }
        fetchOptions.body = JSON.stringify(bodyObj);
      }
      
      console.log(`[NikkePlugin] 请求URL: ${url}`);
      console.log(`[NikkePlugin] 请求选项: ${JSON.stringify(fetchOptions, null, 2)}`);
      
      const response = await fetch(url, fetchOptions);
      const status = response.status;
      const responseText = await response.text();
      
      console.log(`[NikkePlugin] 响应状态: ${status}`);
      console.log(`[NikkePlugin] 响应内容: ${responseText.substring(0, 500)}...`); 
      
      return { status, data: JSON.parse(responseText), text: responseText };
    } catch (error) {
      console.error(`[NikkePlugin] 请求错误: ${error.message}`);
      return { error: error.message };
    }
  }

  async getRoleInfo(e) {
    try {
      const [, server, roleName] = e.msg.match(this.rule[0].reg);
      if (!server || !roleName) return e.reply('❌ 参数错误，请使用 #nikke角色信息 服务器 角色名 格式');
      
      const areaId = this.normalizeServer(server);
      
      const url = 'https://api.blablalink.com/api/game/proxy/Game/GetSavedRoleInfo';
      
      const params = new URLSearchParams({
        game_id: '29080',
        area_id: areaId,
        role_name: encodeURIComponent(roleName)
      });
      
      const result = await this.apiRequest(`${url}?${params}`, {
        method: 'GET',
        commonParamsAreaId: areaId 
      });
      
      if (result.error) return e.reply(`🌐 网络错误: ${result.error}`);
      if (result.status !== 200) return e.reply(`📡 HTTP错误: 状态码${result.status}`);
      if (result.data.code !== 0) return e.reply(`❌ API错误: ${result.data.msg} (${result.data.code})`);
      
      const roleInfo = result.data.data?.[0]?.role_info;
      if (!roleInfo || roleInfo.role_name !== roleName) { // 额外检查返回的角色名是否匹配
        return e.reply(`⚠️ 未找到角色 "${roleName}" 在${areaId}服务器的信息。请确认角色名无误或尝试在游戏内查看实际名称。`);
      }
      
      const msg = this.formatRoleInfo(roleInfo);
      e.reply(msg);
    } catch (err) {
      console.error(`[NikkePlugin] 获取角色信息错误: ${err.message}`);
      e.reply(`🛑 运行时错误: ${err.message}`);
    }
  }

  async getRoleList(e) {
    try {
      const [, server] = e.msg.match(this.rule[1].reg);
      if (!server) return e.reply('❌ 参数错误，请使用 #nikke角色列表 服务器 格式');
      
      const areaNumericId = this.areaIdMapToNumeric[server.toLowerCase()];
      if (typeof areaNumericId === 'undefined') {
        return e.reply(`❌ 未知服务器: ${server}。请提供有效的服务器名称 (如 JP)。`);
      }

      const url = 'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters';
      
      const body = JSON.stringify({
        nikke_area_id: areaNumericId
      });
      
      const result = await this.apiRequest(url, {
        method: 'POST',
        body,
        commonParamsAreaId: 'global',
        dataStatisticsPageId: 'https://www.blablalink.com/shiftyspad/nikke-list' // 使用准确的页面ID
      });
      
      if (result.error) return e.reply(`🌐 网络错误: ${result.error}`);
      if (result.status !== 200) return e.reply(`📡 HTTP错误: 状态码${result.status}`);
      if (result.data.code !== 0) return e.reply(`❌ API错误: ${result.data.msg} (${result.data.code})`);
      
      const roleList = result.data.data?.characters || []; 
      if (!roleList.length) return e.reply(`⚠️ 在${server}服务器未找到任何角色`);
      
      const msg = this.formatRoleList(roleList, server);
      e.reply(msg);
    } catch (err) {
      console.error(`[NikkePlugin] 获取角色列表错误: ${err.message}`);
      e.reply(`🛑 运行时错误: ${err.message}`);
    }
  }

  // 新增函数：获取单个角色详细参数
  async getCharacterDetails(e) {
    try {
      const [, server, nameCodeStr] = e.msg.match(this.rule[3].reg);
      const nameCode = parseInt(nameCodeStr);

      if (!server || isNaN(nameCode)) {
        return e.reply('❌ 参数错误，请使用 #nikke详细角色信息 服务器 角色代码 格式 (角色代码为数字)');
      }
      
      const areaNumericId = this.areaIdMapToNumeric[server.toLowerCase()];
      if (typeof areaNumericId === 'undefined') {
        return e.reply(`❌ 未知服务器: ${server}。请提供有效的服务器名称 (如 JP)。`);
      }

      const url = 'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails';
      
      const body = JSON.stringify({
        nikke_area_id: areaNumericId,
        name_codes: [nameCode] // 注意：name_codes 是一个数组
      });
      
      const result = await this.apiRequest(url, {
        method: 'POST',
        body,
        commonParamsAreaId: 'global', // 根据抓包，这里是global
        dataStatisticsPageId: `https://www.blablalink.com/shiftyspad/nikke?from=list&nikke=${nameCode}` // 动态设置
      });
      
      if (result.error) return e.reply(`🌐 网络错误: ${result.error}`);
      if (result.status !== 200) return e.reply(`📡 HTTP错误: 状态码${result.status}`);
      if (result.data.code !== 0) return e.reply(`❌ API错误: ${result.data.msg} (${result.data.code})`);
      
      const characterDetails = result.data.data?.character_details?.[0]; // 取数组的第一个元素
      if (!characterDetails) {
        return e.reply(`⚠️ 未找到角色代码 "${nameCode}" 的详细信息在${server}服务器。`);
      }
      
      const msg = this.formatCharacterDetails(characterDetails);
      e.reply(msg);

    } catch (err) {
      console.error(`[NikkePlugin] 获取详细角色信息错误: ${err.message}`);
      e.reply(`🛑 运行时错误: ${err.message}`);
    }
  }

  async getUserInfo(e) {
    try {
      const url = 'https://api.blablalink.com/api/ugc/proxy/standalonesite/User/GetUserInfoNew';
      
      const result = await this.apiRequest(url, {
        method: 'POST',
        body: '{}',
        commonParamsAreaId: 'JP', 
        dataStatisticsPageId: 'https://www.blablalink.com/shiftyspad' // 默认值
      });
      
      if (result.error) return e.reply(`🌐 网络错误: ${result.error}`);
      if (result.status !== 200) return e.reply(`📡 HTTP错误: 状态码${result.status}`);
      if (result.data.code !== 0) return e.reply(`❌ API错误: ${result.data.msg}`);
      
      const userInfo = result.data.data?.info; 
      if (!userInfo) return e.reply('⚠️ 未找到账号信息');
      
      const msg = this.formatUserInfo(userInfo);
      e.reply(msg);
    } catch (err) {
      console.error(`[NikkePlugin] 获取账号信息错误: ${err.message}`);
      e.reply(`🛑 运行时错误: ${err.message}`);
    }
  }

  normalizeServer(server) {
    const serverMap = {
      'global': 'Global',
      'jp': 'JP',
      'kr': 'KR',
      'tw': 'TW',
      'cn': 'CN'
    };
    return serverMap[server.toLowerCase()] || server;
  }

  formatRoleInfo(role) {
    return [
      '🎮 Nikke角色信息:',
      `👤 角色名: ${role.role_name || '未知'}`,
      `🆔 角色ID: ${role.role_id || '未知'}`,
      `🌐 服务器: ${role.area_id || '未知'}`,
      `⚔️ 战力: ${role.power || '未知'}`,
      `🌟 星级: ${role.star || '未知'}`,
      `📊 等级: ${role.level || '未知'}`,
      `📅 创建时间: ${role.create_time ? new Date(role.create_time * 1000).toLocaleString() : '未知'}`,
      `📜 进度: ${role.progress || '未知'}`
    ].join('\n');
  }

  formatRoleList(roles, server) {
    let msg = `🎮 ${server}服务器角色列表 (共${roles.length}个):\n`;
    
    roles.forEach((role, index) => {
      const charName = this.characterNameMap[role.name_code] || `未知角色(${role.name_code})`;
      msg += `\n${index + 1}. ${charName}`;
      msg += `\n    ⚔️ 战力: ${role.combat || '未知'} | 🌟 等级: ${role.lv || '未知'}`;
      msg += index < roles.length - 1 ? '\n──────────────────' : '';
    });
    
    return msg;
  }

  // 新增格式化函数：详细角色信息
  // 新增格式化函数：详细角色信息
  formatCharacterDetails(details) {
    const charName = this.characterNameMap[details.name_code] || `未知角色(${details.name_code})`;
    let msg = [
      `🔍 妮姬详细信息 - ${charName}:`,
      `🆔 角色代码: ${details.name_code || '未知'}`,
      `📊 等级: ${details.lv || '未知'}`,
      `⚔️ 战力: ${details.combat || '未知'}`,
      `⭐ 核心等级: ${details.core || '0'}`,
      `✨ 魅力等级: ${details.attractive_lv || '0'}`,
      `🛡️ 技能1等级: ${details.skill1_lv || '未知'}`,
      `🛡️ 技能2等级: ${details.skill2_lv || '未知'}`,
      `💥 爆发技能等级: ${details.ulti_skill_lv || '未知'}`,
      `🏷️ 品级: ${details.grade || '未知'}`
    ];

    // 添加装备信息
    msg.push('\n─── 装备信息 ───');
    
    // 头部装备
    if (details.head_equip_tid) {
      msg.push(`头盔等级: ${details.head_equip_lv || '0'} | 公司类型: ${details.head_equip_corporation_type || '无'}`);
      if (details.head_equip_option1_id || details.head_equip_option2_id || details.head_equip_option3_id) {
        msg.push(`  词条: ${details.head_equip_option1_id || '无'} ${details.head_equip_option2_id || '无'} ${details.head_equip_option3_id || '无'}`);
      }
    } else {
      msg.push('头盔: 无');
    }

    // 身体装备 (胸甲)
    if (details.torso_equip_tid) {
      msg.push(`胸甲等级: ${details.torso_equip_lv || '0'} | 公司类型: ${details.torso_equip_corporation_type || '无'}`);
      if (details.torso_equip_option1_id || details.torso_equip_option2_id || details.torso_equip_option3_id) {
        msg.push(`  词条: ${details.torso_equip_option1_id || '无'} ${details.torso_equip_option2_id || '无'} ${details.torso_equip_option3_id || '无'}`);
      }
    } else {
      msg.push('胸甲: 无');
    }

    // 手臂装备
    if (details.arm_equip_tid) {
      msg.push(`臂甲等级: ${details.arm_equip_lv || '0'} | 公司类型: ${details.arm_equip_corporation_type || '无'}`);
      if (details.arm_equip_option1_id || details.arm_equip_option2_id || details.arm_equip_option3_id) {
        msg.push(`  词条: ${details.arm_equip_option1_id || '无'} ${details.arm_equip_option2_id || '无'} ${details.arm_equip_option3_id || '无'}`);
      }
    } else {
      msg.push('臂甲: 无');
    }

    // 腿部装备
    if (details.leg_equip_tid) {
      msg.push(`腿甲等级: ${details.leg_equip_lv || '0'} | 公司类型: ${details.leg_equip_corporation_type || '无'}`);
      if (details.leg_equip_option1_id || details.leg_equip_option2_id || details.leg_equip_option3_id) {
        msg.push(`  词条: ${details.leg_equip_option1_id || '无'} ${details.leg_equip_option2_id || '无'} ${details.leg_equip_option3_id || '无'}`);
      }
    } else {
      msg.push('腿甲: 无');
    }

    // 羁绊物品
    if (details.favorite_item_tid) {
        msg.push(`羁绊物品等级: ${details.favorite_item_lv || '0'}`);
    }

    // 谐振方块
    if (details.harmony_cube_tid) {
        msg.push(`谐振方块等级: ${details.harmony_cube_lv || '0'}`);
    }


    return msg.join('\n');
  }

  formatUserInfo(user) {
    return [
      '👤 Nikke账号信息:',
      `🆔 账号ID: ${user.id || '未知'}`,
      `👤 用户名: ${user.username || '未设置'}`,
      `🌐 地区: ${user.region || '未知'}`,
      `📅 注册时间: ${user.created_on ? new Date(user.created_on * 1000).toLocaleString() : '未知'}`,
      `📱 手机: ${user.phone ? '已绑定' : '未绑定'}`,
      `📧 邮箱: ${user.email ? '已绑定' : '未绑定'}`,
      `🎮 游戏ID: ${user.game_id || '未知'}`,
      `👑 VIP等级: ${user.vip_level || '0'}`,
      `📊 账号等级: ${user.level || '未知'}`
    ].join('\n');
  }
}
