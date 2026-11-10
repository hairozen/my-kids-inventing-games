async(page)=>{
 const check=(value,text)=>{if(!value)throw new Error(text);};
 await page.goto('http://127.0.0.1:4173/games/hogwarts/');
 const layouts=[];
 for(const [width,height]of [[1365,900],[1024,768],[1280,600],[844,390],[667,375],[390,844],[390,600],[320,568]]){
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(()=>{const a=document.querySelector('.intro').getBoundingClientRect(),b=document.querySelector('.selection-panel').getBoundingClientRect(),draw=document.querySelector('#draw').getBoundingClientRect();return {width:innerWidth,height:innerHeight,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,drawFits:draw.bottom<=innerHeight&&draw.top>=0,overflow:document.documentElement.scrollWidth>innerWidth};});
  check(!layout.overlap&&layout.drawFits&&!layout.overflow,'Menu layout '+JSON.stringify(layout));
  await page.locator('#draw').click();await page.locator('#start').waitFor({state:'visible'});
  const fit=await page.evaluate(()=>{const a=document.querySelector('#start').getBoundingClientRect(),b=document.querySelector('#back-menu').getBoundingClientRect();return a.top>=0&&a.bottom<=innerHeight&&b.bottom<=innerHeight;});
  check(fit,'Power buttons clipped at '+width+'x'+height);
  layouts.push({...layout,powerFits:fit});await page.locator('#back-menu').click();
 }
 await page.setViewportSize({width:1200,height:800});
 const selections=[];
 for(const id of ['harry','hermione','ron']){await page.locator(`[data-character="${id}"]`).click();const v=await page.evaluate(()=>({selected:magicRace.selected,pressed:document.querySelectorAll('[data-character][aria-pressed="true"]').length}));check(v.selected===id&&v.pressed===1,'Selection '+id);selections.push(id);}
 await page.locator('#draw').click();await page.locator('#back-menu').click();await page.waitForTimeout(1700);check(await page.evaluate(()=>magicRace.screen==='menu'&&document.querySelector('#power-screen').classList.contains('hidden')),'Cancelled draw reopened');
 await page.evaluate(()=>{window.audioCalls=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...a){window.audioCalls++;return original.apply(this,a);};});
 await page.locator('[data-character="harry"]').click();await page.waitForTimeout(150);
 const enabledCalls=await page.evaluate(()=>audioCalls);await page.locator('#sound').click();await page.locator('[data-character="ron"]').click();await page.waitForTimeout(150);const mutedCalls=await page.evaluate(()=>audioCalls);check(enabledCalls>0&&enabledCalls===mutedCalls,'Mute emitted audio');await page.locator('#sound').click();await page.waitForTimeout(150);const unmutedCalls=await page.evaluate(()=>audioCalls);check(unmutedCalls>mutedCalls,'Unmute failed');
 await page.locator('#draw').click();await page.locator('#start').waitFor({state:'visible'});await page.locator('#start').click();await page.waitForTimeout(3400);
 await page.keyboard.down('Escape');const before=await page.evaluate(()=>magicRace.state.time);await page.keyboard.down('Escape');await page.waitForTimeout(400);await page.keyboard.up('Escape');const repeated=await page.evaluate(()=>({paused:magicRace.paused,time:magicRace.state.time}));check(repeated.paused&&repeated.time===before,'Escape repeat advanced game');await page.locator('#resume').click();await page.waitForTimeout(200);check(await page.evaluate(()=>!magicRace.paused&&magicRace.state.time>0),'Resume failed');
 // Dispatch browser window/tab events without modifying simulation state.
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check(await page.evaluate(()=>magicRace.paused),'Blur did not pause');await page.locator('#resume').click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});check(await page.evaluate(()=>magicRace.paused),'Hidden tab did not pause');await page.evaluate(()=>delete document.hidden);await page.locator('#resume').click();
 const touchLayouts=[];
 for(const [width,height]of [[390,600],[390,844],[667,375],[844,390]]){await page.setViewportSize({width,height});const v=await page.evaluate(()=>{const a=document.querySelector('.active-power').getBoundingClientRect(),b=document.querySelector('.touch-controls').getBoundingClientRect();return {width:innerWidth,height:innerHeight,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};});check(!v.overlap,'Touch controls hidden by HUD '+JSON.stringify(v));touchLayouts.push(v);}
 await page.setViewportSize({width:390,height:600});
 const initialX=await page.evaluate(()=>{const s=magicRace.state;return s.racers.find(r=>r.id===s.playerId).x;});
 const left=await page.locator('[data-control="left"]').boundingBox();await page.mouse.move(left.x+left.width/2,left.y+left.height/2);await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();const movedX=await page.evaluate(()=>{const s=magicRace.state;return s.racers.find(r=>r.id===s.playerId).x;});check(movedX<initialX-1,'Pointer movement failed');
 await page.locator('[data-control="jump"]').click();await page.waitForTimeout(180);const jumped=await page.evaluate(()=>{const s=magicRace.state;return s.racers.find(r=>r.id===s.playerId).jump>0;});check(jumped,'Pointer jump failed');
 await page.locator('[data-control="cast"]').click();await page.waitForTimeout(80);const cast=await page.evaluate(()=>{const s=magicRace.state;return s.racers.find(r=>r.id===s.playerId).activeUntil>s.time;});check(cast,'Pointer cast failed');
 await page.keyboard.press('Escape');await page.locator('#restart').click();check(await page.evaluate(()=>magicRace.screen==='menu'&&magicRace.state===null),'Pause restart failed');
 return {layouts,selections,drawCancellation:true,audio:{enabledCalls,mutedCalls,unmutedCalls},escapeRepeat:repeated,blurPause:true,hiddenTabPause:true,touchLayouts,pointer:{movedX,initialX,jumped,cast},restart:true};
}
