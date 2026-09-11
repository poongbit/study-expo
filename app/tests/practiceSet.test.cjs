require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAttempt, parseAttempt } = require('../src/basics/straightLine.ts');
const { goalStatus, summarizeSet, attemptsInSet, latestSetId } = require('../src/basics/practiceSet.ts');
function attempt(i, amplitude = 0, count = 101) {
  const a = createAttempt([{strokeId: `stroke-${i}`, inputType: 'TOUCH', startedAt: 1,
    points: Array.from({length:count}, (_,j) => ({x:0.15+0.7*j/(count-1),y:0.5+amplitude*Math.sin(12*Math.PI*j/(count-1)),t:j*10}))}], null);
  return {...a, attemptId:`attempt-${i}`, createdAt:i+1, practiceSetId:'set-1',setRuleVersion:4};
}
test('twelve successes recommend progression only after the twentieth attempt', () => {
  const good = Array.from({length:12},(_,i)=>attempt(i));
  assert.equal(summarizeSet(good).recommended,false);
  const completed = summarizeSet([...good,...Array.from({length:8},(_,i)=>attempt(i+12,0.01))]);
  assert.equal(completed.complete,true); assert.equal(completed.achieved,12); assert.equal(completed.recommended,true);
});
test('a set ends at twenty even without twelve successes', () => {
  const s = summarizeSet(Array.from({length:20},(_,i)=>attempt(i,i<2?0:.01)));
  assert.equal(s.complete,true); assert.equal(s.recommended,false);
  assert.match(s.remaining,/画面|화면/);
});
test('sparse, mixed and legacy input are pending and still consume a slot', () => {
  const records = [attempt(0,0,2), {...attempt(1),inputType:'MIXED'}, {...attempt(2),metricVersion:1},...Array.from({length:17},(_,i)=>attempt(i+3))];
  assert.deepEqual(records.slice(0,5).map(goalStatus),['pending','pending','pending','achieved','achieved']);
  const s=summarizeSet(records); assert.equal(s.complete,true); assert.equal(s.pending,3); assert.equal(s.recommended,true);
});
test('restoration excludes old rules, deduplicates and caps sets at twenty', () => {
  const records=Array.from({length:21},(_,i)=>attempt(i));
  const legacy={...attempt(22),practiceSetId:undefined,setRuleVersion:undefined};
  const next={...attempt(23),practiceSetId:'set-2'};
  const oldSet={...attempt(24),practiceSetId:'old-set',setRuleVersion:2,createdAt:99};
  const history=[oldSet,next,legacy,...records.reverse(),records[0]];
  assert.deepEqual(attemptsInSet(history,'set-1').map(a=>a.attemptId),Array.from({length:20},(_,i)=>`attempt-${i}`));
  assert.equal(latestSetId(history),'set-2'); assert.equal(latestSetId([legacy]),null);
});
test('set metadata survives reload and malformed metadata is rejected', () => {
  const a=attempt(0); assert.deepEqual(parseAttempt(JSON.stringify(a)),a);
  for (const changed of [{setRuleVersion:5},{practiceSetId:'../bad'},{practiceSetId:undefined},{setRuleVersion:undefined}])
    assert.throws(()=>parseAttempt(JSON.stringify({...a,...changed})));
});
test('improvement describes a measured reduction and withholds cross-tool comparison', () => {
  const records=[attempt(0,0.01),...Array.from({length:19},(_,i)=>attempt(i+1))];
  assert.match(summarizeSet(records).improvement,/반복 흔들림/);
  records[19]={...records[19],inputType:'STYLUS'};
  assert.match(summarizeSet(records).improvement,/비교는 보류/);
});
