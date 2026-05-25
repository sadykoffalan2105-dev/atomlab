import type { Connect } from 'vite'
import { handleLearnChat } from './learnChat'

export function learnChatMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/learn/chat')) {
      next()
      return
    }
    void handleLearnChat(req, res)
  }
}
