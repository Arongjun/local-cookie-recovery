import assert from 'node:assert/strict';
import {merge,key,details} from './core.mjs';
const c={domain:'example.com',path:'/',name:'a',value:'old',hostOnly:true,secure:true,httpOnly:true,sameSite:'lax',session:true};
const p={...c,name:'partition',partitionKey:{topLevelSite:'https://other.test',hasCrossSiteAncestor:true}};
const existing=[c],current=new Map(existing.map(c=>[key(c),c]));
const source=[{...c,value:'new'},p,{...c,name:'fail'},{...c,name:'expired',session:false,expirationDate:1}];
const api={getAll:async options=>{assert.deepEqual(options,{partitionKey:{}});return [...current.values()]},set:async d=>{if(d.name==='fail')throw Error('test rejected');assert.deepEqual(d.partitionKey,p.partitionKey);const result={...p};current.set(key(result),result);return result;}};
const report=await merge(api,source,async()=>{});
assert.equal(report.added,1);assert.equal(report.conflicts,1);assert.equal(report.failed.length,1);assert.equal(report.expired,1);assert.equal(report.verified,1);assert.equal(report.originalChanged,0);assert.equal(current.get(key(c)).value,'old');
assert.equal(details(c).domain,undefined);assert.throws(()=>details({...c,domain:'example.com@evil.test'}));
console.log('partition, conflict preservation, verification, failure and validation checks passed');

// A misleading set() response must not turn a successful write into a failure.
const stored=new Map();let writes=0;
const oddApi={getAll:async()=>[...stored.values()],set:async d=>{
 writes++;
 if(d.name==='missing')return null;
 stored.set(key({...c,...d}),{...c,...d,...(d.name==='adjusted'?{sameSite:'strict'}:{})});
 return {...c,name:'unrelated'};
}};
const checked=await merge(oddApi,[{...c,name:'good'},{...c,name:'good'},{...c,name:'adjusted'},{...c,name:'missing'}],async()=>{});
assert.equal(writes,3);assert.equal(checked.alreadySame,1);assert.equal(checked.added,2);
assert.equal(checked.verified,1);assert.equal(checked.adjusted,1);assert.equal(checked.failed.length,1);
console.log('misleading set result, duplicate input, adjusted attributes and missing readback checks passed');
