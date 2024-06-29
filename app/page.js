'use client'

import axios from 'axios'
import React, { useState } from 'react'
import './style/style.css'

export default function Home() {
  // 初始化
  const [addressText, setAddressText] = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const [addressList, setAddressList] = useState([])
  const [expandedItems, setExpandedItems] = useState({})
  const [showToast, setShowToast] = useState(false)

  // 处理表单提交的异步函数
  const handleSubmit = async () => {
    try {
      // 向后端发送POST请求，解析地址
      const response = await axios.post('http://localhost:3001/parse-address', {
        addressText
      })
      // 更新解析结果状态
      setParsedResult(response.data)
      // 将新的地址及解析结果添加到地址列表中
      setAddressList([...addressList, { text: addressText, ...response.data }])
      // 清空地址文本框
      setAddressText('')
    } catch (error) {
      // 错误处理，打印错误信息至控制台
      console.error('地址解析错误:', error)
    }
  }

  // 处理LLM解析的异步函数
  const handleLLMParse = async () => {
    try {
      // 使用glm4_total函数解析地址
      const response = await axios.post(
        'http://localhost:3001/llm-parse-address',
        { addressText }
      )
      // 更新解析结果状态
      setParsedResult(response.data)
      // 将新的地址及解析结果添加到地址列表中
      setAddressList([...addressList, { text: addressText, ...response.data }])
      // 清空地址文本框
      setAddressText('')
      // 显示toast提示
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } catch (error) {
      // 错误处理，打印错误信息至控制台
      console.error('LLM地址解析错误:', error)
    }
  }

  const toggleExpand = (index) => {
    setExpandedItems((prev) => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  return (
    <div className='container'>
      {showToast && <div className='toast'>LLM处理完成!</div>}
      <div className='card'>
        <h1 className='title'>地址解析器</h1>
        <textarea
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder='输入地址信息'
          className='input'
          style={{ height: 'auto', minHeight: '40px', maxHeight: '200px' }}
          rows={1}
          onInput={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
        />
        <h2 className='instruction'>
          <p>请确保地址信息格式正确，否则解析结果可能不准确!</p>
          <p>例如：</p>
          <p>
            &emsp; 1. 江苏省南京市栖霞区文苑路21号南京邮电大学仙林校区
            张三15866697485
          </p>
          <p>
            &emsp;2.
            张三15866697485江苏省南京市栖霞区文苑路21号南京邮电大学仙林校区
          </p>
          <div className='attention'>
            <p>请注意——</p>
            <p>&emsp;尽量保持标准格式输入!!</p>
            <p>&emsp;LLM的输出不一定准确!!</p>
          </div>
        </h2>

        <div className='button-container'>
          <button onClick={handleSubmit} className='button'>
            解析
          </button>
          <button onClick={handleLLMParse} className='button'>
            试试LLM处理
          </button>
        </div>

        {parsedResult && (
          <div className='result'>
            <p>
              <span className='label'>省:</span>
              {parsedResult.province || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>市:</span>
              {parsedResult.city || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>区:</span>
              {parsedResult.area || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>街道:</span>
              {parsedResult.street || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>详细地址:</span>
              {parsedResult.addr || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>姓名:</span>
              {parsedResult.name || '错误输入'}{' '}
            </p>
            <p>
              <span className='label'>电话号码:</span>
              {parsedResult.mobileNumber || '错误输入'}{' '}
            </p>
          </div>
        )}
      </div>
      <div className='card'>
        <h2 className='title'>已输入的地址</h2>
        <ul>
          {' '}
          {addressList.map((address, index) => (
            <li key={index} className='address-item'>
              <p>
                {index + 1}: {address.text}
              </p>
              <button
                className='expand-button'
                onClick={() => toggleExpand(index)}
              >
                {expandedItems[index] ? '折叠' : '展开'}
              </button>
              {expandedItems[index] && (
                <div className='label'>
                  <p>省: {address.province || '错误输入'}</p>
                  <p>市: {address.city || '错误输入'}</p>
                  <p>区: {address.area || '错误输入'}</p>
                  <p>街道: {address.street || '错误输入'}</p>
                  <p>详细地址: {address.addr || '错误输入'}</p>
                  <p>姓名: {address.name || '错误输入'}</p>
                  <p>电话号码: {address.mobileNumber || '错误输入'}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
