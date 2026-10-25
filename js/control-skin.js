(() => {
  const attackImage=document.createElement('img');attackImage.id='attackArt';attackImage.alt='';attackImage.draggable=false;
  document.querySelector('#attack').prepend(attackImage);
  for(const [id,src]of [['left','assets/images/walk-l.png'],['right','assets/images/walk-r.png']]){
    const button=document.getElementById(id);button.replaceChildren();const im=document.createElement('img');im.src=src;im.alt='';im.draggable=false;button.append(im);
  }
  let last='';
  window.SweeperSkin={setGauge(percent){
    const n=Math.min(5,Math.max(0,Math.floor((percent+1e-7)/20)));
    document.querySelector('#tankFull').style.clipPath=n?'inset('+(n===5?26:77-(n-1)*11.5)+'% 0 0 0)':'inset(100% 0 0 0)';
    document.querySelector('#feverTank').dataset.lamps=String(n);
  },setAttackImage(src){if(src!==last){attackImage.src=src;last=src;}}};
})();
