import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const edgeBrowserSrc = readFileSync(join(root, 'dist/assets/index-BT9TiaQB.js'), 'utf8')
  .slice(0, 500)
console.log('bundle check skipped — inline test')

const TEXT = 'Привет! Это проверка мужского голоса учителя.'

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script type="module">
const TRUSTED='6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS='wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const WIN_EPOCH=11644473600;
const GEC_VER='1-130.0.2849.68';
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
async function secGec(){let ticks=Date.now()/1000+WIN_EPOCH;ticks-=ticks%300;ticks*=1e7;return sha(String(Math.floor(ticks))+TRUSTED);}
const uuid=()=>crypto.randomUUID().replace(/-/g,'');
window.__ttsTest=async(text)=>{
  const token=await secGec();
  const url=WSS+'?TrustedClientToken='+TRUSTED+'&Sec-MS-GEC='+token+'&Sec-MS-GEC-Version='+GEC_VER+'&ConnectionId='+uuid();
  return new Promise((resolve)=>{
    const parts=[]; let ws;
    const timer=setTimeout(()=>resolve({ok:false,reason:'timeout',bytes:0}),20000);
    try{ws=new WebSocket(url);}catch(e){clearTimeout(timer);resolve({ok:false,reason:String(e),bytes:0});return;}
    ws.binaryType='arraybuffer';
    ws.onopen=()=>{const ts=new Date().toUTCString().replace('GMT','GMT+0000 (Coordinated Universal Time)');const rid=uuid();
      ws.send('X-Timestamp:'+ts+'\\rContent-Type:application/json; charset=utf-8\\rPath:speech.config\\r\\r{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      ws.send('X-RequestId:'+rid+'\\rContent-Type:application/ssml+xml\\rX-Timestamp:'+ts+'Z\\rPath:ssml\\r\\r<speak version=\\'1.0\\' xml:lang=\\'ru-RU\\'><voice name=\\'ru-RU-DmitryNeural\\'>'+text+'</voice></speak>');};
    ws.onmessage=(ev)=>{if(typeof ev.data==='string'){if(ev.data.includes('turn.end')&&parts.length){clearTimeout(timer);resolve({ok:true,bytes:parts.reduce((a,p)=>a+p.length,0)});}return;}
      const v=new Uint8Array(ev.data);const hl=(v[0]<<8)|v[1];const hdr=new TextDecoder().decode(v.subarray(2,hl+2));if(hdr.includes('Path:audio'))parts.push(v.subarray(hl+2));};
    ws.onerror=()=>{clearTimeout(timer);resolve({ok:false,reason:'ws_error',bytes:0});};
    ws.onclose=()=>{if(parts.length){clearTimeout(timer);resolve({ok:true,bytes:parts.reduce((a,p)=>a+p.length,0)});}};
  });
};
</script></body></html>`

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.route('https://atomlab-test.local/', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  )
  await page.goto('https://atomlab-test.local/')
  const edge = await page.evaluate(async (text) => window.__ttsTest(text), TEXT)
  console.log('EDGE_BROWSER', edge)

  await page.route('https://js.puter.com/v2/', (route) => route.continue())
  await page.addScriptTag({ url: 'https://js.puter.com/v2/' })
  await page.waitForFunction(() => !!window.puter?.ai?.txt2speech, null, { timeout: 30000 }).catch(() => null)
  const puter = await page.evaluate(async (text) => {
    if (!window.puter?.ai?.txt2speech) return { ok: false, reason: 'no api' }
    try {
      const audio = await window.puter.ai.txt2speech(text, { voice: 'Maxim', engine: 'standard', language: 'ru-RU' })
      const res = await fetch(audio.src)
      const buf = new Uint8Array(await res.arrayBuffer())
      return { ok: buf.length > 200, bytes: buf.length, type: res.headers.get('content-type') }
    } catch (e) {
      return { ok: false, reason: String(e.message || e) }
    }
  }, TEXT)
  console.log('PUTER', puter)
  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
