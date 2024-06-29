// 引入axios库用于HTTP请求，fs库用于文件系统操作，path库用于路径处理
const axios = require('axios')
const fs = require('fs')
const path = require('path')
// 引入地区列表和相关工具函数
const { areaList, formatProvince, zipCode } = require('./area-list.js')
const { stringify } = require('querystring')

// 从JSON文件中加载姓氏数据，并进行错误处理
const surnameFilePath = path.resolve(__dirname, 'surname.json')
let surnames
try {
  surnames = JSON.parse(fs.readFileSync(surnameFilePath, 'utf-8'))
} catch (error) {
  console.error(`读取姓氏文件错误: ${error}`)
  surnames = []
}

// 初始化变量
let defaultData = []
const cityMap = {}
const areaMap = {}

// 解析地区数据的函数
const parseArea = (list, init = false) => {
  if (!init && defaultData.length) {
    return true
  }

  defaultData = list

  defaultData.forEach((province) => {
    if (province.city) {
      province.city.forEach((city) => {
        if (city.name !== '其他') {
          // 构建城市映射，方便后续通过城市名查找省份和城市信息
          cityMap[city.name] = cityMap[city.name] || []
          cityMap[city.name].push({
            p: province.name,
            c: city.name,
            a: city.area || []
          })
        }

        if (city.area) {
          city.area.forEach((area) => {
            if (area !== '其他') {
              // 构建地区映射，方便后续通过地区名查找省份和城市信息
              areaMap[area] = areaMap[area] || []
              areaMap[area].push({ p: province.name, c: city.name })
            }
          })
        }
      })
    }
  })
}

// 导出parseArea函数
module.exports = { parseArea }

// 格式化邮政编码数据的函数
const zipCodeFormat = () => {
  const list = []
  if (zipCode) {
    zipCode.forEach((province) => {
      if (province.child) {
        province.child.forEach((city) => {
          if (city.child) {
            city.child.forEach((area) => {
              list.push(area.zipcode)
            })
          }
        })
      }
    })
  }
  return list
}

const zipCodeList = zipCodeFormat()
parseArea(areaList)

// 根据提供的关键字提取地区信息的辅助函数
// Helper function to extract area based on provided keyword
function extractArea(address, areaIndex, cityKeyword) {
  let extractedArea = ''
  if (address.includes(cityKeyword)) {
    extractedArea = address.substr(
      address.lastIndexOf(cityKeyword, areaIndex) + 1,
      areaIndex - address.lastIndexOf(cityKeyword, areaIndex)
    )
  } else {
    if (areaMap[address.substr(areaIndex - 2, 3)]) {
      extractedArea = address.substr(areaIndex - 2, 3)
    } else if (areaMap[address.substr(areaIndex - 3, 4)]) {
      extractedArea = address.substr(areaIndex - 3, 4)
    }
  }
  return extractedArea
}

// GLM4 辅助函数
async function glm4(input, type) {
  let data
  if (type === 1) {
    // 构造请求数据
    data = JSON.stringify({
      model: 'glm-4-air',
      messages: [
        {
          role: 'system',
          content:
            '检查输入的地址是否逻辑上包含中国人的名字,如果没有,请返回数字0,要是包含了请返回1,避免解释!'
        },
        { role: 'user', content: input }
      ]
    })
  } else if (type === 2) {
    // 构造请求数据
    data = JSON.stringify({
      model: 'glm-4-air',
      messages: [
        {
          role: 'system',
          content:
            '将地址拆分为不同部分,并以JSON格式回复,包括以下键: province, city, area, street, addr,name.请注意name是人的姓名,假设输入:"南京栖霞南京邮电大学仙林校区 陈毅15896687456",请输出:{"province": "江苏","city": "南京","area": "栖霞区","street": "文苑路","addr": "9号南京邮电大学仙林校区","name": "陈毅"}.请不要解释!不要markdown格式!'
        },
        { role: 'user', content: input }
      ]
    })
  } else if (type === 3) {
    // 构造请求数据
    data = JSON.stringify({
      model: 'glm-4-air',
      messages: [
        {
          role: 'system',
          content:
            '将地址拆分为不同部分,并以JSON格式回复,包括以下键: province, city, area, street, addr, name, mobileNumber.没有的就留空不要扔去我提供的内容,请不要解释!不要markdown格式!'
        },
        { role: 'user', content: input }
      ]
    })
  } else {
    console.error('Invalid type:', type)
    return null
  }

  const config = {
    method: 'post',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    headers: {
      Authorization: 'Bearer Your-API-Key',
      'Content-Type': 'application/json'
    },
    data: data
  }

  try {
    // 发送请求并解析响应
    const response = await axios(config)
    //console.log('USE GLM4!')
    console.log('Raw glm4-Response:', response.data.choices[0].message.content)

    // 获取响应内容
    let responseData = response.data.choices[0].message.content

    // 移除多余的字符，如 ```
    responseData = responseData.replace(/```/g, '').trim()

    // 检查并解析为 JSON 对象
    let parsedData
    try {
      parsedData = JSON.parse(responseData)
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError)
      console.log('Attempting to fix JSON format...')

      // 尝试修复 JSON 格式
      if (responseData.startsWith('{') && responseData.endsWith('}')) {
        // 尝试去掉非 JSON 部分
        const jsonStart = responseData.indexOf('{')
        const jsonEnd = responseData.lastIndexOf('}') + 1
        const jsonString = responseData.substring(jsonStart, jsonEnd)
        parsedData = JSON.parse(jsonString)
      } else {
        throw new Error('Invalid JSON format')
      }
    }

    console.log('Parsed Data:', parsedData)
    return parsedData
  } catch (error) {
    console.error('Error calling GLM-4:', error)
    return null
  }
}

// 地址解析辅助函数，用于解析地址中的省份、城市等信息
async function detailParseForward(address) {
  // 初始化解析结果
  const parse = { province: '', city: '', area: '', addr: '', name: '' }
  if (!address) return parse

  // 定义省份和城市的关键字
  const provinceKey = [
    '特别行政区',
    '自治区',
    '维吾尔自治区',
    '壮族自治区',
    '回族自治区',
    '省直辖',
    '省',
    '市'
  ]
  const cityKey = [
    '布依族苗族自治州',
    '苗族侗族自治州',
    '自治州',
    '州',
    '市',
    '县'
  ]

  // 遍历地区列表进行匹配
  for (const province of defaultData) {
    const index = address.indexOf(province.name)
    if (index > -1) {
      if (index > 0) {
        parse.name = address.substring(0, index).trim()
      }
      parse.province = province.name
      address = address.substring(index + province.name.length)

      // 去除省份后的关键字
      for (const key of provinceKey) {
        if (address.startsWith(key)) {
          address = address.substring(key.length)
        }
      }

      // 匹配城市
      for (const city of province.city) {
        const cityIndex = address.indexOf(city.name)
        if (cityIndex > -1 && cityIndex < 3) {
          parse.city = city.name
          address = address.substring(cityIndex + city.name.length)

          // 去除城市后的关键字
          for (const key of cityKey) {
            if (address.startsWith(key)) {
              address = address.substring(key.length)
            }
          }

          // 匹配地区
          if (city.area) {
            for (const area of city.area) {
              const areaIndex = address.indexOf(area)
              if (areaIndex > -1 && areaIndex < 3) {
                parse.area = area
                address = address.substring(areaIndex + area.length)
                break
              }
            }
          }
          break
        }
      }
      parse.addr = address.trim()
      break
    }
  }
  return parse
}

// 详细地址解析函数
async function detailParse(address, { ignoreArea = false } = {}) {
  // 初始化解析结果，包含省份、城市、区域、名称、地址、错误代码
  const parse = {
    province: '', // 省份
    city: '', // 城市
    area: '', // 区域
    name: '', // 名称
    _area: '', // 内部使用的区域标识
    addr: address, // 原始地址
    code: 0 // 状态码，0表示初始状态，1表示使用GLM4解析
  }

  // 如果地址长度小于等于4，直接返回初始解析结果
  if (address.length <= 4) return parse

  let areaIndex = -1 // 用于记录区域关键词在地址中的索引

  // 如果不忽略地区解析
  if (!ignoreArea) {
    const areaKeywords = ['县', '区', '旗'] // 定义区域关键词
    for (const keyword of areaKeywords) {
      // 检查地址中是否包含区域关键词
      if (address.includes(keyword)) {
        areaIndex = address.indexOf(keyword) // 记录关键词索引
        // 根据关键词提取区域名称
        parse.area =
          keyword === '旗'
            ? address.substr(areaIndex - 1, 2)
            : extractArea(address, areaIndex, '市')
        parse.addr = address.substr(areaIndex + 1).trim() // 更新剩余地址
        break // 找到关键词后退出循环
      }
    }
  }

  // 如果没有找到地区，尝试匹配市
  if (areaIndex === -1) {
    if (address.includes('市')) {
      areaIndex = address.indexOf('市')
      parse.area = address.substr(0, areaIndex + 1) // 提取市名称
      parse.addr = address.substr(areaIndex + 1).trim() // 更新剩余地址
    } else {
      parse.addr = address.trim() // 如果没有市，直接使用原始地址
    }
  }

  // 尝试匹配区域关键词
  const regionKeywords = ['市', '盟', '州'] // 定义区域关键词
  for (const keyword of regionKeywords) {
    if (address.includes(keyword)) {
      parse._area = address.substr(address.indexOf(keyword) - 2, 2) // 提取可能的区域标识
      // 如果区域标识在cityMap中有对应的城市信息，则退出循环
      if (cityMap[parse._area]) break
    }
  }

  // 如果没有找到地区或地区信息不完整，尝试使用GLM4解析
  if (
    areaIndex === -1 ||
    !parse.area ||
    parse.area.length > 4 ||
    !parse._area
  ) {
    const glmResult = await glm4(address, 2) // 异步调用GLM4进行地址解析
    if (glmResult) {
      // 如果GLM4返回结果，合并结果到解析对象，并设置状态码为1
      Object.assign(parse, glmResult, { code: 1 })
      // console.log('parse: ', parse)
      return parse // 返回解析结果
    }
  }

  // 如果找到了地区信息，尝试匹配省份和城市
  if (parse.area && areaMap[parse.area]) {
    // 使用areaMap查找省份和城市信息
    const areaData = areaMap[parse.area]
    const addrPart = address.substring(0, areaIndex)
    if (areaData.length === 1) {
      parse.province = areaData[0].p // 设置省份
      parse.city = areaData[0].c // 设置城市
    } else {
      // 如果areaData中有多个匹配项，尝试找到最匹配的一项
      const match = areaData.find(
        (item) => item.p.includes(addrPart) || item.c === parse._area
      )
      if (match) {
        parse.province = match.p // 设置省份
        parse.city = match.c // 设置城市
      } else {
        parse.result = areaData // 如果没有匹配项，将所有可能的结果保存在result中
      }
    }
  } else if (parse._area) {
    // 如果没有找到地区信息，但找到了_area，尝试在cityMap中查找城市信息
    const city = cityMap[parse._area]
    if (city) {
      parse.province = city[0].p // 设置省份
      parse.city = city[0].c // 设置城市
      parse.addr = address
        .substring(address.indexOf(parse.city) + parse.city.length + 1)
        .trim() // 更新剩余地址
      // 尝试在城市下找到匹配的区域
      city[0].a.some((area) => {
        const areaWithoutSuffix = area.replace(/[区县旗市盟州]$/, '') // 去除区域名称后缀
        if (parse.addr.includes(areaWithoutSuffix)) {
          parse.area = area // 设置区域
          parse.addr = parse.addr.replace(area, '').trim() // 更新剩余地址
          return true // 找到匹配项后退出some循环
        }
      })
    }
  }

  // 返回最终的解析结果
  return parse
}

// 主要的地址解析函数
async function parse(address = '') {
  // 初始化一个对象，用于存储解析后的地址信息
  const parsed = {
    name: '', // 收货人姓名
    mobileNumber: '', // 手机号
    detail: '', // 详细地址
    zip_code: '', // 邮编
    province: '', // 省份
    city: '', // 城市
    area: '', // 地区
    street: '', // 街道
    addr: '' // 完整地址
  }

  // 定义一个需要从地址中移除的关键词数组
  const keywordsToRemove = [
    '地址',
    '收货地址',
    '收货人',
    '收件人',
    '收货',
    '邮编',
    '电话',
    '：',
    ':',
    '；',
    ';',
    ',',
    ',',
    '。',
    '!',
    '@',
    '#',
    '\\$',
    '%',
    '\\^',
    '&',
    '\\*',
    '\\(',
    '\\)',
    '_',
    '\\+',
    '=',
    '\\[',
    '\\]',
    '\\{',
    '\\}',
    '\\|',
    '\\\\',
    '<',
    '>',
    '\\?',
    '/',
    '~',
    '`',
    '-'
  ]

  // 使用正则表达式移除关键词，并将连续的空白符替换为单个空格，然后去除首尾空白
  address = address
    .replace(new RegExp(keywordsToRemove.join('|'), 'g'), '')
    .replace(/[a-zA-Z]+/g, '') // 移除所有英文字母
    .replace(/ {2,}/g, ' ') // 替换多个空格为一个空格
    .trim() // 去除字符串首尾的空白字符
    .replace(/(\d{3})[-\s]*(\d{4})[-\s]*(\d{4})/g, '$1$2$3') // 格式化邮编
    .replace(/\s+/g, '') // 再次移除多余的空格

  // 定义手机号和电话的正则表达式
  const mobileReg = /(\+86-?|86-?)?1[0-9]{10}/g
  const phoneReg = /((\d{3,4}-)?\d{7,8}|\d{7,12})/g

  // 从地址中提取手机号，并更新地址字符串
  const mobileMatch = mobileReg.exec(address)
  if (mobileMatch) {
    parsed.mobileNumber = mobileMatch[0]
    address = address.replace(mobileMatch[0], '')
  }

  // 从地址中提取电话，并更新地址字符串
  const phoneMatch = phoneReg.exec(address)
  if (phoneMatch) {
    parsed.phoneNumber = phoneMatch[0]
    address = address.replace(phoneMatch[0], '')
  }

  // 如果地址字符串为空，则直接返回解析结果
  if (!address) return parsed

  // 遍历邮编列表，尝试匹配并提取邮编
  zipCodeList.forEach((zip) => {
    const index = address.indexOf(zip)
    if (index !== -1) {
      parsed.zip_code = zip
      address = address.replace(zip, '')
    }
  })

  // 异步调用函数解析地址详细信息
  let addressDetails = await detailParseForward(address)
  let assumedProvince = addressDetails.province

  // 如果没有城市信息，则重新解析地址，可能需要忽略地区信息
  if (!addressDetails.city) {
    addressDetails = await detailParse(address)
    if (addressDetails.area && !addressDetails.city) {
      addressDetails = await detailParse(address, { ignoreArea: true })
    }
    // 如果非GLM4解析，则从解析结果中提取姓名
    if (addressDetails.code !== 1) {
      await extractNameFromDetails(addressDetails, parsed)
    }
  } else {
    // 如果已有城市信息，则直接从解析结果中提取姓名
    await extractNameFromDetails(addressDetails, parsed)
  }

  // 更新省份和城市信息
  parsed.province = addressDetails.province || assumedProvince
  parsed.city = addressDetails.city
  parsed.area = addressDetails.area
  parsed.street = addressDetails.street
  parsed.addr = addressDetails.addr
  parsed.name = addressDetails.name

  // 格式化省份名称
  if (parsed.province) {
    formatProvince.forEach((province) => {
      if (province.name.startsWith(parsed.province)) {
        parsed.province = province.name
      }
    })
  }

  // 根据省份信息格式化城市名称
  zipCode.forEach((province) => {
    if (parsed.province.startsWith(province.name)) {
      province.child.forEach((city) => {
        if (city.name.startsWith(parsed.city)) {
          parsed.city = city.name
        }
      })
    }
  })

  // 如果存在地址信息，则进一步提取街道信息
  if (parsed.addr) {
    const streetKeywords = ['街道', '街', '道', '路']
    const streetIndex = Math.min(
      ...streetKeywords
        .map((keyword) => parsed.addr.indexOf(keyword))
        .filter((index) => index !== -1)
    )

    if (streetIndex !== Infinity) {
      parsed.street = parsed.addr.substring(0, streetIndex + 1).trim()
      parsed.addr = parsed.addr.substring(streetIndex + 1).trim()
    }
  }

  // 返回解析后的地址信息
  return parsed
}

// 此函数用于从给定的详细信息中提取姓名，并将其存储在parsed对象的name属性中。
// 如果详细信息中直接包含了姓名，则直接赋值。否则，尝试从地址信息中解析出姓名。
async function extractNameFromDetails(detail, parsed) {
  // 首先检查detail对象中是否直接包含了姓名字段
  if (detail.name) {
    // 如果存在，直接将姓名赋值给parsed.name并结束函数
    parsed.name = detail.name
    return
  }

  // 如果detail.addr不存在，初始化为空字符串以避免后续操作出错
  if (!detail.addr) {
    detail.addr = ''
    return
  }

  // 遍历预定义的姓氏列表（surnames数组未在本代码段中定义，需确保其在函数作用域内已定义）
  let surnameIndex = -1 // 初始化姓氏索引为-1，表示未找到匹配的姓氏
  for (let i = 0; i < surnames.length; i++) {
    const surname = surnames[i] // 获取当前遍历到的姓氏
    // 使用indexOf查找该姓氏是否出现在detail.addr中
    const index = detail.addr.indexOf(surname)
    if (index !== -1) {
      // 如果找到了姓氏，记录其索引并跳出循环
      surnameIndex = index
      break
    }
  }

  // 如果成功找到姓氏
  if (surnameIndex !== -1) {
    // 从姓氏开始处截取字符串作为名字，并去除前后空白字符后存入parsed.name
    parsed.name = detail.addr.substring(surnameIndex).trim()
    // 更新detail.addr，移除已提取的名字部分并去除前后空白字符
    detail.addr = detail.addr.substring(0, surnameIndex).trim()
  }

  // 对解析出的姓名进行验证，如果不存在或者名字大于2的GLM4判定为没有姓名包含在内
  if (!parsed.name || parsed.name.length > 2) {
    if (!(await glm4(detail.addr + parsed.name, 1))) {
      // 将parsed.name的内容附加回地址信息，并清空parsed.name
      detail.addr += parsed.name
      parsed.name = ''
    }
  }
}

async function LLMparse(addressText) {
  const result = await glm4(addressText, 3)
  return result
}

module.exports = { parse, LLMparse }
;(async () => {
  try {
    console.log(
      'Example-2: ',
      await parse('南京栖霞南京邮电大学仙林校区 王三48598875648')
    )
  } catch (error) {
    console.error('Error parsing address:', error)
  }
})()

// (async () => {
//   try {
//     console.log(
//       'Example-2: ',
//       await parse(
//         '#!$Rdaw南awdd!awdawda@bpdmv*so$eij*fad京市栖霞awd区文苑dawd路21号南!@$!!@京邮电大学仙林校区赵awd三1586awd669dawd7485awd'
//       )
//     )
//   } catch (error) {
//     console.error('Error parsing address:', error)
//   }
// })()

// (async () => {
//   try {
//     console.log(
//         'Example-3: ',
//         await parse(
//             '上海市浦东新区陆家嘴环路1000号东方明珠塔B座2501室李四13912345678'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log(
//         'Example-4: ',
//         await parse('北京市海淀区中关村大街1号院A座麻痹+8618888888888'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log('Example-5: ', await parse('王五18600001234'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log(
//         'Example-6: ',
//         await parse(
//             '广东省深圳市南山区深南大道9999号腾讯大厦B座2楼刘六13711112222'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log(
//         'Example-7: ',
//         await parse(
//             '广州市天河区珠江新城华夏路10号富力中心/-&* 陈七15919998888'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log(
//         'Example-8: ',
//         await parse('13600007777 广东省广州市天河区体育西路103号'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log(
//         'Example-9: ',
//         await parse(
//             '赵八   13577779999 浙江省杭州市西湖区文三路456号高新大厦A座'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log('Example-10: ', await parse(''));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log('Example-11: ', await parse('15088886666'));
//   } catch (error) {
//     console.error('Error parsing address:', error);
//   }
// })();
