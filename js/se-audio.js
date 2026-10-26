/* Shared SE playback. Buffers are decoded once; each playback gets a fresh source node. */
(()=>{'use strict';const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
function create(manifest,{keys=Object.keys(manifest),getVolume=()=>1,maxVoices=6,onStatus=()=>{}}={}){
 const buffers=new Map(),players=new Map(),active=new Set(),failed=new Map();let context=null,master=null,completed=0,backend='webaudio',reason='',lastError='',warmed=false,previewId=0,lastNotification='';
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Web Audio未対応');if(location.protocol==='file:')throw Error('file直開き');context=new AC({latencyHint:'interactive'});master=context.createGain();master.connect(context.destination);}catch(e){backend='htmlaudio';reason=e.message;}
 const initialBackend=backend,initialReason=reason;
 const status=()=>({engineVersion:'1.1',backend,reason,lastError,volume:clamp(getVolume()),total:keys.length,ready:backend==='webaudio'?buffers.size:players.size,completed,failed:[...failed.keys()],contextState:context?.state||null,baseLatency:context?.baseLatency??null,outputLatency:context?.outputLatency??null,active:active.size,decodedBytes:[...buffers.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0)});
 function notify(){const s=status(),signature=JSON.stringify([s.backend,s.contextState,s.completed,s.ready,s.failed,s.lastError,s.reason,s.volume]);if(signature===lastNotification)return;lastNotification=signature;try{onStatus(s);}catch{}}
 function configureSession(){try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback';}catch{}}
 function warm(){if(!context||context.state==='closed'||warmed)return;try{const node=context.createBufferSource();node.buffer=context.createBuffer(1,128,context.sampleRate);node.connect(master);node.onended=()=>node.disconnect();node.start(0);if(context.state==='running')warmed=true;}catch{}}
 function unlock(){if(!context||backend!=='webaudio')return Promise.resolve(false);configureSession();if(context.state==='closed'){lastError='AudioContextが終了しています。再読み込みか互換再生をお試しください。';notify();return Promise.resolve(false);}if(context.state==='running'){warm();notify();return Promise.resolve(true);}try{const pending=context.resume();warm();notify();return Promise.resolve(pending).then(()=>{lastError='';warm();notify();return context.state==='running';},e=>{if(context.state!=='running')lastError=e.name+': '+e.message;notify();return context.state==='running';});}catch(e){lastError=e.name+': '+e.message;notify();return Promise.resolve(false);}}
 if(context){context.onstatechange=()=>{if(context.state!=='running')warmed=false;notify();};}
 function cancelPreview(){previewId++;}
 async function preview(key){const id=++previewId;if(backend==='htmlaudio')return play(key);lastError='';const resumed=await Promise.race([unlock(),new Promise(resolve=>setTimeout(()=>resolve(false),400))]);if(id!==previewId)return null;if(!resumed||context.state!=='running'){lastError='音声が停止中です。もう一度試聴するか、互換再生をお試しください。';notify();return null;}const handle=play(key);notify();return handle;}
 function setCompatibility(on){stopAll();backend=on?'htmlaudio':initialBackend;reason=on?'手動の互換再生':initialReason;lastError='';notify();}
 function makeMedia(key){const a=new Audio(manifest[key]);a.preload='auto';players.set(key,a);return a;}
 function play(key){const volume=clamp(getVolume());if(!manifest[key]||volume<=0||active.size>=maxVoices)return null;
  let node=null,gain=null,media=null,finished=false;
  if(backend==='webaudio'){const buffer=buffers.get(key);if(!buffer||context.state!=='running')return null;node=context.createBufferSource();node.buffer=buffer;gain=context.createGain();gain.gain.value=volume;node.connect(gain);gain.connect(master);}
  else{media=players.get(key)||makeMedia(key);if([...active].some(h=>h.media===media))media=new Audio(manifest[key]);try{media.currentTime=0;}catch{}media.volume=volume;}
  const handle={media,onended:null,onerror:null,pause:()=>stop(),get volume(){return gain?gain.gain.value:media.volume;},set volume(v){const value=clamp(v);if(gain&&context.state!=='closed')gain.gain.setValueAtTime(value,context.currentTime);else if(media)media.volume=value;}};
  function release(error=false){if(finished)return;finished=true;active.delete(handle);if(node){node.onended=null;try{node.disconnect();gain.disconnect();}catch{}}if(media){media.onended=null;media.onerror=null;}try{(error?handle.onerror:handle.onended)?.();}catch{}}
  function stop(){if(finished)return;if(node)try{node.stop();}catch{}if(media)media.pause();release();}
  active.add(handle);if(node){node.onended=()=>release();try{node.start(0);}catch{release(true);return null;}}
  else{media.onended=()=>release();media.onerror=()=>release(true);media.play().catch(()=>release(true));}
  return handle;
 }
 function stopAll(){cancelPreview();for(const h of [...active])h.pause();}
 function setVolume(value){for(const h of active)h.volume=value;notify();}
 let ready;
 if(backend==='webaudio'){
  let next=0;async function worker(){while(next<keys.length){const key=keys[next++];try{const response=await fetch(manifest[key]);if(!response.ok)throw Error('HTTP '+response.status);const bytes=await response.arrayBuffer(),buffer=await context.decodeAudioData(bytes);buffers.set(key,buffer);}catch(e){failed.set(key,e.message);}completed++;notify();}}
  ready=Promise.all(Array.from({length:Math.min(4,keys.length)},worker)).then(()=>status());
 }else{for(const key of keys)makeMedia(key);completed=keys.length;ready=Promise.resolve(status());notify();}
 notify();return {play,preview,unlock,stopAll,cancelPreview,setCompatibility,setVolume,status,ready};
}
window.SweeperSE={version:'1.1',create};})();
