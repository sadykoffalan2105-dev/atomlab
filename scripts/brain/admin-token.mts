/**
 * npm run brain:admin-token — новый ключ админа мозга (для публичного сервера). Ничего не пишет: печатает ключ и
 * строку для config.json (или переменную среды BRAIN_ADMIN_TOKEN). Ключ хранить как пароль, на сайт не класть.
 */
import crypto from 'node:crypto'

const token = crypto.randomBytes(24).toString('base64url')
console.log(token)
console.error(`\nДобавьте в atomlab-brain-data\\config.json:  "adminToken": "${token}"`)
console.error('или задайте переменную среды BRAIN_ADMIN_TOKEN. Запросы админа: заголовок X-Brain-Admin: <ключ>.')
