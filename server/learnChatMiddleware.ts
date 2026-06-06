import type { Connect } from 'vite'
import { handleLearnChat } from './learnChat'
import { handleLearnTts } from './learnTts'

export function learnChatMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url?.startsWith('/api/learn/chat')) {
      void handleLearnChat(req, res)
      return
    }
    if (req.url?.startsWith('/api/learn/tts')) {
      void handleLearnTts(req, res)
      return
    }
    next()
  }
}
