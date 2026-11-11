import { Platform } from 'react-native';
/** Non-interactive host-document tooltip; never captures pointer or keyboard input. */
export function showConversationTooltip(element: unknown, data: {title:string; host:string; path?:string}, colors: {surface1:string; border:string; foreground:string; foregroundMuted:string}) {
  if (Platform.OS !== 'web') return () => {};
  const source = element as {ownerDocument?:any; getBoundingClientRect?():any};
  const document = source?.ownerDocument;
  const browser = document?.defaultView;
  if (!document || !browser || !source.getBoundingClientRect || document.querySelector('[role="menu"], [role="dialog"]')) return () => {};
  const box = source.getBoundingClientRect();
  const card = document.createElement('div');
  card.setAttribute('role','tooltip');
  card.setAttribute('aria-label','Conversation details');
  const width = Math.min(360,browser.innerWidth-16);
  Object.assign(card.style,{position:'fixed',zIndex:'10000',pointerEvents:'none',boxSizing:'border-box',width:`${width}px`,padding:'12px',borderRadius:'8px',border:`1px solid ${colors.border}`,background:colors.surface1,color:colors.foreground,fontFamily:'inherit',fontSize:'12px',lineHeight:'20px',boxShadow:'0 4px 16px rgba(0,0,0,.14)'});
  const heading = document.createElement('div'); heading.textContent=data.title;
  Object.assign(heading.style,{fontSize:'13px',marginBottom:'4px',overflowWrap:'anywhere'});card.appendChild(heading);
  const icons = {server:'M3 3h18v7H3ZM3 14h18v7H3ZM7 6h.01M7 17h.01',folder:'M3 7V5h6l2 2h10v13H3Z'};
  for (const [icon,text] of [['server',data.host],['folder',data.path]] as const) {
    if(!text) continue;
    const line=document.createElement('div'); Object.assign(line.style,{display:'flex',gap:'8px',alignItems:'center',color:colors.foregroundMuted});
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','14');svg.setAttribute('height','14');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.style.flexShrink='0';
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',icons[icon]);svg.appendChild(path);line.appendChild(svg);
    const label=document.createElement('span');label.textContent=text;Object.assign(label.style,{overflowWrap:'anywhere',minWidth:'0'});line.appendChild(label);card.appendChild(line);
  }
  document.body.appendChild(card);
  const height=card.getBoundingClientRect().height;
  const beside=box.right+8+width<=browser.innerWidth-8;
  Object.assign(card.style,{left:`${beside?box.right+8:Math.max(8,Math.min(box.left,browser.innerWidth-width-8))}px`,top:`${Math.max(8,Math.min(beside?box.top:box.bottom+8,browser.innerHeight-height-8))}px`});
  const remove=()=>card.remove();
  const observer = new browser.MutationObserver(() => { if(document.querySelector('[role="menu"], [role="dialog"]')) remove(); });
  observer.observe(document.body,{childList:true,subtree:true});
  browser.addEventListener('scroll',remove,true);browser.addEventListener('resize',remove);
  return () => {remove();observer.disconnect();browser.removeEventListener('scroll',remove,true);browser.removeEventListener('resize',remove);};
}
