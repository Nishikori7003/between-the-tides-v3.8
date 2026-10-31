(function () {
  'use strict';
  const $=id=>document.getElementById(id), bar=$('floating-status'), panel=document.querySelector('#play .dashboard'), handle=$('status-drag');
  let position=null, drag=null;
  function clamp(){if(!position||bar.hidden)return;const r=bar.getBoundingClientRect();position.x=Math.max(8,Math.min(position.x,innerWidth-r.width-8));position.y=Math.max(8,Math.min(position.y,innerHeight-r.height-8));bar.style.left=position.x+'px';bar.style.top=position.y+'px';bar.style.transform='none';}
  function update(){
    const tide=$('tide').textContent, zones=tide==='High tide'?'A / Wait':tide==='Mid tide'?'A/B':'A/B/C';
    $('mini-tide').textContent=`${tide} · ${zones}`;
    const eco=$('eco').textContent.match(/(\d)\/3/);$('mini-eco').textContent=`Ecology ${eco?eco[1]:'—'}/3`;$('mini-eco').classList.toggle('mini-danger',!!eco&&Number(eco[1])<=1);
    $('mini-round').textContent='Rounds '+$('effective').textContent.replace(/\s/g,'');
    bar.hidden=$('play').hidden||panel.getBoundingClientRect().bottom>0;
    clamp();
  }
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=bar.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};handle.setPointerCapture(e.pointerId);e.preventDefault();handle.focus({preventScroll:true});});
  handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;position={x:e.clientX-drag.dx,y:e.clientY-drag.dy};clamp();});
  function stop(){drag=null;}handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);handle.addEventListener('lostpointercapture',stop);
  handle.addEventListener('keydown',e=>{const moves={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};if(e.key==='Home'){e.preventDefault();position=null;bar.style.left='50%';bar.style.top='8px';bar.style.transform='translateX(-50%)';}else if(moves[e.key]){e.preventDefault();const r=bar.getBoundingClientRect(),d=moves[e.key];position={x:r.left+d[0],y:r.top+d[1]};clamp();}});
  $('status-return').onclick=()=>{panel.setAttribute('tabindex','-1');panel.scrollIntoView({block:'start',behavior:'instant'});panel.focus({preventScroll:true});update();};
  new MutationObserver(update).observe(panel,{childList:true,subtree:true,characterData:true});
  new MutationObserver(update).observe($('play'),{attributes:true,attributeFilter:['hidden']});
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);
  update();
})();
