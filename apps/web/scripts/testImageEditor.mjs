// Exercise the real editor in a production build without a backend or stored photos.
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const output = await mkdtemp(resolve(tmpdir(), 'gallery-editor-'));
const entry = resolve('.editor-smoke.html');
let server, browser;
try {
  await writeFile(entry, `<div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
const { default: Editor } = await import('./src/components/ImageEditorModal');
const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=480;
const ctx=canvas.getContext('2d'); ctx.fillStyle='#f97316'; ctx.fillRect(0,0,640,480);
ctx.fillStyle='#2563eb'; ctx.fillRect(100,100,220,160);
window.saved=0;
createRoot(document.getElementById('root')).render(React.createElement(Editor, {
 imageUrl:canvas.toDataURL(), nativeWidth:640, nativeHeight:480,
 onSave:async()=>{window.saved++}, onClose:()=>{window.closedEditor=true}
}));
</script>`);
  await build({ build: { outDir:output, rollupOptions:{input:entry}, emptyOutDir:true } });
  server = await preview({ build:{outDir:output}, preview:{port:4188,strictPort:true} });
  browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});
    const errors=[];
    await page.addInitScript(() => { window.addEventListener('unhandledrejection', e => { console.error('REJECTION', JSON.stringify(e.reason)); }); });
    page.on('console', msg=>{if(msg.type()==='error') console.error(msg.text());});
    page.on('pageerror', error=>{ errors.push(error.message); console.error('Browser error:',String(error),error.stack); });
    await page.route('**/*', route => {
      const req=route.request();
      // Keep the library's translation service entirely local, including its missing-key reports.
      if (['i18n.ultrafast.io','neo.wordplex.io'].some(host=>req.url().includes(host))) return route.fulfill({json:[]});
      if (!['GET','HEAD'].includes(req.method()) || /^https?:/.test(req.url()) && !req.url().startsWith('http://localhost:4188/')) return route.abort();
      return route.continue();
    });
    await page.goto('http://localhost:4188/.editor-smoke.html');
    await page.locator('.FIE_buttons-history-btns').waitFor({state:'visible'});
    await page.locator(viewport.width>800 ? '.FIE_tabs_navbar' : '.FIE_tabs-drawer' ).waitFor({state:viewport.width>800?'visible':'attached',timeout:10000});
    await page.getByRole('button',{name:'Curves',exact:true}).click();
    await page.getByRole('button',{name:'Levels',exact:true}).click();
    await page.getByRole('button',{name:'Adjust',exact:true}).click();
    
    await page.getByRole('button',{name:'Save Changes',exact:true}).click();
    await page.waitForFunction(()=>window.saved===1);
    await page.getByRole('button',{name:'Close editor'}).click();
    await page.waitForFunction(()=>window.closedEditor===true);
    if(errors.length) throw new Error(errors.join('\n'));
    console.log(`PASS ${viewport.width}px: editor, history, tabs, curves, levels, local export, close`);
    await page.close();
  }
} finally {
  await browser?.close(); server?.httpServer.close();
  await rm(entry,{force:true}); await rm(output,{recursive:true,force:true});
}
