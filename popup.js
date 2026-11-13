const status=document.querySelector('#status');
async function refresh(){
 const {report:r}=await chrome.storage.local.get('report');
 if(!r)return;
 if(r.error){status.textContent=`迁移中断：${r.error}。已完成的写入可能保留，可重新合并。`;return;}
 status.textContent=[
  r.reportVersion?'': '这是旧版统计，部分失败可能实际已写入。',
  r.complete?'合并完成':'正在合并，完成后点击“查看结果”。',
  `来源 ${r.source} 条（分区 ${r.partitioned} 条）`,
  `原有 ${r.before} 条；合并后 ${r.after??'待核对'} 条`,
  `回读一致 ${r.verified} 条；浏览器调整属性 ${r.adjusted??'旧版未统计'} 条`,
  `重复跳过 ${r.alreadySame} 条；冲突保留原值 ${r.conflicts} 条`,
  `过期跳过 ${r.expired} 条；失败 ${r.failed.length} 条`,
  `原有记录变化 ${r.originalChanged} 条`,
  ...r.failed.map(f=>`第 ${f.index+1} 条：${f.reason}`)
 ].filter(Boolean).join('\n');
}
document.querySelector('#report').onclick=refresh;
document.querySelector('#export').onclick=async()=>{
 try{
  const cookies=await chrome.cookies.getAll({partitionKey:{}});
  const url=URL.createObjectURL(new Blob([JSON.stringify(cookies)],{type:'application/json'}));
  try{await chrome.downloads.download({url,filename:'cookie-recovery-v2-private.json',saveAs:true});}
  finally{URL.revokeObjectURL(url);}
  status.textContent=`已请求导出 ${cookies.length} 条，其中分区 Cookie ${cookies.filter(c=>c.partitionKey).length} 条。`;
 }catch(e){status.textContent=e.message;}
};
document.querySelector('#import').onclick=async()=>{
 try{
  const file=document.querySelector('#file').files[0];if(!file)throw Error('请选择导出文件');
  const result=await chrome.runtime.sendMessage({action:'import',cookies:JSON.parse(await file.text())});
  status.textContent=result.error||'正在合并。完成后点击“查看结果”。';
 }catch(e){status.textContent=e.message;}
};
refresh();
