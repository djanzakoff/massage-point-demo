import {Art} from './art.js';
import * as T from './three.module.js';

// One persistent 3D scene: dragging moves the objects, never recreates canvases.
class CarouselArt extends Art {
  constructor(canvas) {
    super(canvas, 'carousel');
    this.root.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); });
    this.root.clear();
    this.carouselItems = Array.from({length:6}, (_,i) => {
      const group = new T.Group();
      this.sculpture(i,group);
      this.root.add(group);
      return group;
    });
    this.phase = 0;
  }
  tick(t) {
    if (!this.running) return;
    if (this.carouselItems) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.root.rotation.set(0,0,0);
      this.root.position.set(0,0,0);
      this.carouselItems.forEach((group,i) => {
        const d = ((i-this.phase+3)%6+6)%6-3;
        const distance = Math.abs(d);
        const angle=d*Math.PI/3;
        group.visible = distance < 2.8;
        group.position.set(Math.sin(angle)*3.2,-.12*(1-Math.cos(angle)),(Math.cos(angle)-1)*2.8);
        group.scale.setScalar(.93-Math.min(distance,2.8)*.16);
        group.rotation.set(.05, reduced ? d*.3 : Math.sin(t*.0005+i)*.23+t*.00009+d*.3, -.05*d);
      });
      if (!this.renderer.software || !this.lastDraw || t-this.lastDraw>50) {
        this.renderer.render(this.scene,this.camera);
        this.lastDraw=t;
      }
    }
    this.frame=requestAnimationFrame(t=>this.tick(t));
  }
}

export function attachCarousel(car, initial, update, select) {
  const view=new CarouselArt(car.querySelector('canvas'));
  let phase=initial,target=initial,frame=0,active=false,axis='',startX=0,startY=0,startPhase=0,lastX=0,lastAt=0,velocity=0,moved=false,suppressUntil=0,wheelTimer;
  const wrap=n=>((n%6)+6)%6;
  let selected=-1,autoFrame=0,pausedUntil=performance.now()+2500,previousAuto=performance.now();
  const labels=[...car.parentElement.querySelectorAll('.orbit-label')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const pause=()=>{pausedUntil=performance.now()+12000};
  function auto(now){const dt=Math.min(50,now-previousAuto);previousAuto=now;
    if(!active&&!document.hidden&&!reduced.matches&&now>pausedUntil){phase+=dt/16000;target=phase;paint()}
    autoFrame=requestAnimationFrame(auto);
  }
  function paint(){view.phase=phase;
    labels.forEach((label,i)=>{
      const d=((i-phase+3)%6+6)%6-3;
      const x=Math.sin(d*Math.PI/3)*car.clientWidth*1.05;
      label.style.transform=`translateX(${x}px)`;
      label.style.opacity=String(Math.max(0,1-Math.abs(d)*.85));
      label.inert=Math.abs(d)>.5;
      label.setAttribute('aria-hidden',String(Math.abs(d)>.5));
    });const n=wrap(Math.round(phase));if(n!==selected){selected=n;update(n)}}
  function settle(){cancelAnimationFrame(frame);let previous=performance.now();function animate(now){const dt=Math.min(40,now-previous);previous=now;phase+=(target-phase)*(1-Math.exp(-dt/80));if(Math.abs(target-phase)<.001){phase=target;paint();return}paint();frame=requestAnimationFrame(animate)}frame=requestAnimationFrame(animate)}
  function aim(n){pause();target=n;settle()}
  function spacing(){return Math.max(110,car.clientWidth*.34)}
  const down=e=>{if(e.button!==0)return;pause();cancelAnimationFrame(frame);active=true;axis='';moved=false;startX=lastX=e.clientX;startY=e.clientY;startPhase=phase;lastAt=performance.now();velocity=0;car.classList.add('dragging')};
  const move=e=>{if(!active)return;let dx=e.clientX-startX,dy=e.clientY-startY;if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>7){axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(axis==='x')car.setPointerCapture(e.pointerId)}if(axis!=='x')return;e.preventDefault();moved=true;let now=performance.now();velocity=.6*velocity+.4*(e.clientX-lastX)/Math.max(1,now-lastAt);lastX=e.clientX;lastAt=now;phase=startPhase-dx/spacing();paint()};
  const end=e=>{if(!active)return;active=false;car.classList.remove('dragging');if(car.hasPointerCapture(e.pointerId))car.releasePointerCapture(e.pointerId);if(moved){suppressUntil=performance.now()+500;const momentum=performance.now()-lastAt<100?Math.max(-1.1,Math.min(1.1,-velocity*160/spacing())):0;aim(Math.round(phase+momentum))}else if(axis==='y'){aim(Math.round(phase))}};
  const cancel=e=>{if(!active)return;active=false;car.classList.remove('dragging');suppressUntil=performance.now()+300;aim(Math.round(phase))};
  const click=e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}};
  const wheel=e=>{const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!delta)return;pause();e.preventDefault();cancelAnimationFrame(frame);phase+=Math.max(-.5,Math.min(.5,delta/spacing()*.65));paint();clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>aim(Math.round(phase)),140)};
  const key=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();aim(Math.round(phase)+(e.key==='ArrowRight'?1:-1))}};
  car.parentElement.querySelector('.orbit-labels').addEventListener('pointerdown',pause);
  car.addEventListener('pointerdown',down);car.addEventListener('pointermove',move);car.addEventListener('pointerup',end);car.addEventListener('pointercancel',cancel);car.addEventListener('click',click,true);car.addEventListener('wheel',wheel,{passive:false});car.addEventListener('keydown',key);
  car.querySelector('#prevType').onclick=()=>aim(Math.round(phase)-1);
  car.querySelector('#nextType').onclick=()=>aim(Math.round(phase)+1);
  car.querySelector('#chooseType').onclick=()=>{if(performance.now()>=suppressUntil)select(wrap(Math.round(phase)))};
  paint();autoFrame=requestAnimationFrame(auto);
  return {
    goTo(n){const d=((n-wrap(Math.round(phase))+3)%6+6)%6-3;aim(Math.round(phase)+d)},
    destroy(){cancelAnimationFrame(autoFrame);cancelAnimationFrame(frame);clearTimeout(wheelTimer);view.destroy();car.removeEventListener('pointerdown',down);car.removeEventListener('pointermove',move);car.removeEventListener('pointerup',end);car.removeEventListener('pointercancel',cancel);car.removeEventListener('click',click,true);car.removeEventListener('wheel',wheel);car.removeEventListener('keydown',key)}
  };
}
