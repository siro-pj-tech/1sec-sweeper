/* Shared SE playback. Buffers are decoded once; each playback gets a fresh source node. */
(()=>{'use strict';const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
function create(manifest,{keys=Object.keys(manifest),getVolume=()=>1,maxVoices=6,onStatus=()=>{}}={}){
 const buffers=new Map(),players=new Map(),active=new Set(),failed=new Map();let context=null,master=null,completed=0,backend='webaudio',reason='',resumePending=null;
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Web Audio未対応');if(location.protocol==='file:')throw Error('file直開き');context=new AC({latencyHint:'interactive'});master=context.createGain();master.connect(context.destination);}catch(e){backend='htmlaudio';reason=e.message;}
 const status=()=>({backend,reason,total:keys.length,ready:backend==='webaudio'?buffers.size:players.size,completed,failed:[...failed.keys()],contextState:context?.state||null,baseLatency:context?.baseLatency??null,outputLatency:context?.outputLatency??null,active:active.size,decodedBytes:[...buffers.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0)});
 function notify(){try{onStatus(status());}catch{}}
 function unlock(){if(!context||context.state==='running'||context.state==='closed')return Promise.resolve();if(resumePending)return resumePending;try{resumePending=context.resume().catch(()=>{}).finally(()=>{resumePending=null;notify();});return resumePending;}catch{return Promise.resolve();}}
 function makeMedia(key){const a=new Audio(manifest[key]);a.preload='auto';players.set(key,a);return a;}
 function play(key){const volume=clamp(getVolume());if(!manifest[key]||volume<=0||active.size>=maxVoices)return null;
  let node=null,gain=null,media=null,finished=false;
  if(backend==='webaudio'){unlock();const buffer=buffers.get(key);if(!buffer||context.state!=='running')return null;node=context.createBufferSource();node.buffer=buffer;gain=context.createGain();gain.gain.value=volume;node.connect(gain);gain.connect(master);}
  else{media=players.get(key)||makeMedia(key);if([...active].some(h=>h.media===media))media=new Audio(manifest[key]);media.currentTime=0;media.volume=volume;}
  const handle={media,onended:null,onerror:null,pause:()=>stop(),get volume(){return gain?gain.gain.value:media.volume;},set volume(v){const value=clamp(v);if(gain&&context.state!=='closed')gain.gain.setValueAtTime(value,context.currentTime);else if(media)media.volume=value;}};
  function release(error=false){if(finished)return;finished=true;active.delete(handle);if(node){node.onended=null;try{node.disconnect();gain.disconnect();}catch{}}if(media){media.onended=null;media.onerror=null;}try{(error?handle.onerror:handle.onended)?.();}catch{}}
  function stop(){if(finished)return;if(node)try{node.stop();}catch{}if(media)media.pause();release();}
  active.add(handle);if(node){node.onended=()=>release();try{node.start(0);}catch{release(true);return null;}}
  else{media.onended=()=>release();media.onerror=()=>release(true);media.play().catch(()=>release(true));}
  return handle;
 }
 function stopAll(){for(const h of [...active])h.pause();}
 function setVolume(value){for(const h of active)h.volume=value;}
 let ready;
 if(backend==='webaudio'){
  let next=0;async function worker(){while(next<keys.length){const key=keys[next++];try{const response=await fetch(manifest[key]);if(!response.ok)throw Error('HTTP '+response.status);const bytes=await response.arrayBuffer(),buffer=await context.decodeAudioData(bytes);buffers.set(key,buffer);}catch(e){failed.set(key,e.message);}completed++;notify();}}
  ready=Promise.all(Array.from({length:Math.min(4,keys.length)},worker)).then(()=>status());
 }else{for(const key of keys)makeMedia(key);completed=keys.length;ready=Promise.resolve(status());notify();}
 notify();return {play,unlock,stopAll,setVolume,status,ready};
}
window.SweeperSE={create};})();
