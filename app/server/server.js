// 导入Express模块，用于构建web应用
const express = require('express')
// 导入body-parser模块，用于解析请求体中的JSON数据
const bodyParser = require('body-parser')
// 导入cors模块，提供跨域访问支持
const cors = require('cors')
// 导入自定义的地址解析模块
const addressParser = require('./addressParser')

// 创建Express应用实例
const app = express()

// 使用body-parser中间件，以便解析JSON格式的请求体
app.use(bodyParser.json())
// 使用cors中间件，开启跨域访问支持
app.use(cors({ origin: '*' }))

// 定义一个POST接口，用于解析地址
app.post('/parse-address', async (req, res) => {
	const { addressText } = req.body
	try {
		const parsedResult = await addressParser.parse(addressText)
		res.json(parsedResult)
	} catch (error) {
		console.error('Error parsing address:', error)
		res.status(500).json({ error: 'Error parsing address' })
	}
})

// 定义一个POST接口，用于LLM解析地址
app.post('/llm-parse-address', async (req, res) => {
	const { addressText } = req.body
	try {
		const parsedResult = await addressParser.LLMparse(addressText)
		res.json(parsedResult)
	} catch (error) {
		console.error('Error parsing address with LLM:', error)
		res.status(500).json({ error: 'Error parsing address with LLM' })
	}
})

// 设置服务器监听的端口号
const PORT = 3001
// 启动服务器，并在控制台打印运行信息
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`)
})
