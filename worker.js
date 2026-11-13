import {merge} from './core.mjs';
let busy=false;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg.action!=='import') return;
  if(busy){reply({error:'Import already running'});return;}
  busy=true;reply({started:true});
  merge(chrome.cookies,msg.cookies,report=>chrome.storage.local.set({report})).catch(e=>chrome.storage.local.set({report:{error:e.message,complete:true}})).finally(()=>busy=false);
});
