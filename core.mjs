export const key = c => JSON.stringify([c.domain, c.path, c.name, c.partitionKey?.topLevelSite || '', c.partitionKey?.hasCrossSiteAncestor ?? false]);
export function validate(c) {
  if (!c || ['domain','path','name','value'].some(k => typeof c[k] !== 'string') || !c.path.startsWith('/')) throw Error('Invalid cookie record');
  const host = c.domain.replace(/^\./,'');
  const url = new URL(`https://${host}/`);
  if (url.hostname !== host || url.port || url.username || url.password) throw Error('Invalid domain');
  for (const k of ['hostOnly','secure','httpOnly','session']) if (typeof c[k] !== 'boolean') throw Error('Invalid cookie flags');
  if (!['unspecified','no_restriction','lax','strict'].includes(c.sameSite)) throw Error('Invalid SameSite');
  if (!c.session && !Number.isFinite(c.expirationDate)) throw Error('Invalid expiry');
  if (c.partitionKey && (typeof c.partitionKey.topLevelSite !== 'string' || typeof c.partitionKey.hasCrossSiteAncestor !== 'boolean')) throw Error('Invalid partition');
}
export function details(c) {
  validate(c);
  const d = {url:`${c.secure?'https':'http'}://${c.domain.replace(/^\./,'')}/`,name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite};
  if (!c.hostOnly) d.domain=c.domain;
  if (!c.session) d.expirationDate=c.expirationDate;
  if (c.partitionKey) d.partitionKey=c.partitionKey;
  return d;
}
export function equal(a,b) {
  return key(a)===key(b) && ['value','hostOnly','secure','httpOnly','sameSite','session'].every(k=>a[k]===b[k]) && (a.session || Math.abs(a.expirationDate-b.expirationDate)<2);
}
export async function merge(api,source,save) {
  if (!Array.isArray(source) || source.length>20000) throw Error('Invalid backup');
  source.forEach(validate);
  const before=await api.getAll({partitionKey:{}});
  const existing=new Map(before.map(c=>[key(c),c]));
  const report={reportVersion:2.1,source:source.length,partitioned:source.filter(c=>c.partitionKey).length,before:before.length,added:0,adjusted:0,alreadySame:0,conflicts:0,expired:0,failed:[],verified:0,originalChanged:0,complete:false};
  const imported=[];
  await save(report);
  for (let i=0;i<source.length;i++) {
    const c=source[i],k=key(c);
    if(existing.has(k)) { if(equal(c,existing.get(k))) report.alreadySame++; else report.conflicts++; continue; }
    if(!c.session && c.expirationDate<=Date.now()/1000) {report.expired++;continue;}
    try {
      await api.set(details(c));
      // set() can return a different cookie with the same name; verify with getAll().
      imported.push({cookie:c,index:i});existing.set(k,c);
    } catch(e) { report.failed.push({index:i,reason:String(e.message).slice(0,300)}); }
    if(i%100===0) await save(report);
  }
  const after=await api.getAll({partitionKey:{}}),actual=new Map(after.map(c=>[key(c),c]));
  report.after=after.length;
  for (const {cookie:c,index} of imported) {
    const found=actual.get(key(c));
    if (found && equal(c,found)) report.verified++;
    else if (found) report.adjusted++;
    else report.failed.push({index,reason:'Cookie not found during readback'});
  }
  report.added=report.verified+report.adjusted;
  report.originalChanged=before.filter(c=>c.session || c.expirationDate>Date.now()/1000).filter(c=>!actual.has(key(c)) || !equal(c,actual.get(key(c)))).length;
  report.complete=true;await save(report);return report;
}
