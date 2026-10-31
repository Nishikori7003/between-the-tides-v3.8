(function () {
  'use strict';
  const $=id=>document.getElementById(id), key='tides-38-en-player-stats-v1';
  let rows=[], active=null, stage=null, timer=null, audio=null, sound=true, bellBuffer=null, decoding=null, autoLock=false;
  let bellGain=null, clickGain=null, activated=false;
  let waveGain=null, waveBuffer=null, wavePromise=null, waveSource=null, waveGeneration=0;
  const volumes={bgm:20,bell:60,click:25,wave:35}, bgm=$('bgm-audio');
  try { const saved=JSON.parse(localStorage.getItem('tides-volumes-v1')||'{}'); for(const k of Object.keys(volumes)) if(Number.isFinite(saved[k])) volumes[k]=Math.max(0,Math.min(100,saved[k])); } catch(_) {}
  try { const saved=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(saved)) rows=saved; sound=localStorage.getItem('tides-sound')!=='false'; }
  catch (_) { $('storage-note').textContent='Local saving is unavailable. Export your records before leaving.'; }
  function save(){try{localStorage.setItem(key,JSON.stringify(rows));}catch(_){$('storage-note').textContent='Unable to save in this browser. Please export your records.';}}
  // A persisted unfinished session is still unfinished after refresh, never a loss.
  function context(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(!bellGain){bellGain=audio.createGain();clickGain=audio.createGain();bellGain.connect(audio.destination);clickGain.connect(audio.destination);waveGain=audio.createGain();waveGain.connect(audio.destination);applyVolumes();}if(audio.state==='suspended')audio.resume().catch(()=>{});}catch(_){} }
  function loadBell(){context();if(!audio)return Promise.resolve(null);if(!decoding)decoding=audio.decodeAudioData(Uint8Array.from(atob(window.TideBellAudio),c=>c.charCodeAt(0)).buffer).then(b=>bellBuffer=b).catch(()=>null);return decoding;}
  async function tone(timeout=false){if(!sound)return;context();const buffer=bellBuffer||await loadBell();if(!sound||!buffer||audio.state!=='running')return;
    for(let i=0;i<(timeout?2:1);i++){const source=audio.createBufferSource(),gain=audio.createGain(),t=audio.currentTime+i*.48;source.buffer=buffer;gain.gain.setValueAtTime(.65,t);gain.gain.setValueAtTime(.65,t+1);gain.gain.linearRampToValueAtTime(0,t+1.4);source.connect(gain);gain.connect(bellGain);source.start(t,.38,1.4);}
  }
  function loadWave(){context();if(!audio)return Promise.resolve(null);if(!wavePromise)wavePromise=audio.decodeAudioData(Uint8Array.from(atob(window.TideWaveAudio),c=>c.charCodeAt(0)).buffer).then(b=>waveBuffer=b).catch(()=>null);return wavePromise;}
  function stopWave(){waveGeneration++;if(waveSource){try{waveSource.stop();}catch(_){}waveSource=null;}}
  async function wave(){stopWave();const generation=waveGeneration;if(!sound||!volumes.wave||document.hidden)return;context();if(audio?.state==='suspended'){try{await audio.resume();}catch(_){return;}}const buffer=waveBuffer||await loadWave();if(generation!==waveGeneration||!sound||!volumes.wave||document.hidden||!buffer||audio.state!=='running')return;const source=audio.createBufferSource(),envelope=audio.createGain(),t=audio.currentTime;waveSource=source;source.buffer=buffer;envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(1,t+.4);envelope.gain.setValueAtTime(1,t+2.4);envelope.gain.linearRampToValueAtTime(0,t+4);source.connect(envelope);envelope.connect(waveGain);source.start(t);source.onended=()=>{if(waveSource===source)waveSource=null;};}
  loadWave();
  $('preview-wave').onclick=wave;
  loadBell();
  function playMusic(){if(!activated||!sound||!volumes.bgm||document.hidden)return;bgm.play().then(()=>{$('music-status').textContent='Playing: Dreams Become Real · Looping';}).catch(()=>{$('music-status').textContent='Music has not started. Click or press a key to try again.';});}
  function applyVolumes(){if(waveGain)waveGain.gain.value=sound?volumes.wave/100:0;bgm.volume=volumes.bgm/100;if(bellGain)bellGain.gain.value=sound?volumes.bell/100:0;if(clickGain)clickGain.gain.value=sound?volumes.click/100:0;if(!sound||!volumes.bgm){bgm.pause();$('music-status').textContent='Background music is muted.';}else playMusic();}
  function activate(){activated=true;context();playMusic();}
  document.addEventListener('pointerdown',activate);document.addEventListener('keydown',activate);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){bgm.pause();stopWave();}else playMusic();});
  bgm.addEventListener('error',()=>{$('music-status').textContent='Music could not load. Extract the entire folder, including the audio folder.';});
  function clickSound(){if(!sound||!volumes.click)return;context();if(!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(240,t+.055);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.16,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+.065);o.connect(g);g.connect(clickGain);o.start(t);o.stop(t+.07);}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||autoLock||b.id==='preview-wave'||b.id==='preview-bell'||b.id==='preview-click'||b.textContent.includes('Decision Bell'))return;clickSound();},true);
  $('preview-bell').onclick=()=>tone();$('preview-click').onclick=clickSound;
  for(const k of Object.keys(volumes)){const slider=$('volume-'+k);slider.value=volumes[k];$('value-'+k).textContent=volumes[k]+'%';slider.oninput=()=>{volumes[k]=Number(slider.value);$('value-'+k).textContent=volumes[k]+'%';applyVolumes();try{localStorage.setItem('tides-volumes-v1',JSON.stringify(volumes));}catch(_){}};}
  $('sound-enabled').checked=sound;$('sound-enabled').onchange=e=>{sound=e.target.checked;try{localStorage.setItem('tides-sound',String(sound));}catch(_){}applyVolumes();};
  applyVolumes();
  function finishStage(){if(!stage)return;const decision={round:stage.round,phase:stage.phase,seconds:Math.round((Date.now()-stage.start)/100)/10,timeout:stage.expired};if(active){active.decisions.push(decision);save();}stage=null;clearInterval(timer);timer=null;}
  function stats(){const host=$('stats-content');host.replaceChildren();for(const role of ['all','bird','human']){const group=rows.filter(r=>role==='all'||r.role===role),complete=group.filter(r=>r.outcome!=='unfinished'),wins=complete.filter(r=>['playerOnly','both'].includes(r.outcome)).length;const p=document.createElement('p');p.textContent=`${role==='all'?'Overall':role==='bird'?'Play as bird':'Play as human'}: Success rate ${complete.length?(wins/complete.length*100).toFixed(1)+'%':'No data'} · Completed ${complete.length} games · Unfinished ${group.length-complete.length} games. Player alone ${complete.filter(r=>r.outcome==='playerOnly').length} / AI alone ${complete.filter(r=>r.outcome==='aiOnly').length} / Shared success ${complete.filter(r=>r.outcome==='both').length} / Shared failure ${complete.filter(r=>r.outcome==='neither').length}.`;host.append(p);}const decisions=rows.flatMap(r=>r.decisions||[]),regions=decisions.filter(d=>d.phase==='secret');const p=document.createElement('p');p.textContent=`Average time to submit an area choice: ${regions.length?(regions.reduce((n,d)=>n+d.seconds,0)/regions.length).toFixed(1)+' seconds':'No data'}; Timeouts: ${rows.reduce((n,r)=>n+(r.timeouts||0),0)}.`;host.append(p);}
  $('stats-open').onclick=()=>{stats();$('stats-dialog').showModal();};$('stats-close').onclick=()=>$('stats-dialog').close();
  $('stats-export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,rules:'3.75',exportedAt:new Date().toISOString(),games:rows},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Between the Tides_Player-Statistics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function render(s){const timed=s.phase==='secret'||(s.phase==='amount'&&s.playerRole==='human'&&s.revealed.human!=='Wait');const id=timed?`${s.round}:${s.phase}`:null;
    if(stage&&stage.id!==id)finishStage();
    if(s.result&&active){const player=s.result[s.playerRole],other=s.result[s.playerRole==='bird'?'human':'bird'];Object.assign(active,{outcome:player?(other?'both':'playerOnly'):(other?'aiOnly':'neither'),endedAt:new Date().toISOString(),score:s.score,reason:s.result.reason});save();active=null;}
    $('turn-timer').hidden=!timed;if(!timed)return;
    if(!stage){stage={id,round:s.round,phase:s.phase,start:Date.now(),limit:s.phase==='amount'?15:s.round===1?60:30,expired:false};timer=setInterval(tick,200);}tick();
  }
  function tick(){if(!stage)return;const left=Math.max(0,Math.ceil(stage.limit-(Date.now()-stage.start)/1000));$('turn-timer').textContent=left?`Time to choose: ${left} seconds`:'Time is up! Please choose an action and confirm.';$('turn-timer').classList.toggle('timer-urgent',left<=10);
    if(left===0&&!stage.expired){stage.expired=true;if(active){active.timeouts++;save();}tone(true);const selected=document.querySelector(stage.phase==='secret'?'[data-action][aria-pressed="true"]':'[data-amount][aria-pressed="true"]');if(selected){const confirm=document.querySelector('#primary-controls button');if(confirm&&!confirm.disabled){autoLock=true;try{confirm.click();}finally{autoLock=false;}}}}
  }
  window.TideExtras={render,wave,bell:()=>{if(!autoLock)tone();},start(role,bird){finishStage();active={id:Date.now()+'-'+Math.random().toString(36).slice(2),startedAt:new Date().toISOString(),role,bird:window.Tides.BIRDS[bird].name,outcome:'unfinished',decisions:[],timeouts:0};rows.push(active);save();},abandon(){stopWave();finishStage();active=null;$('turn-timer').hidden=true;},};
})();
