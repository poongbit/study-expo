require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAttempt } = require('../src/basics/straightLine.ts');
const { analyzeBatch } = require('../src/basics/batchAnalysis.ts');
function line(start=.15,end=.85,y=.5) {
  return {strokeId:`s-${start}`,inputType:'TOUCH',startedAt:1,points:Array.from({length:51},(_,i)=>({x:start+(end-start)*i/50,y,t:i*10}))};
}
function attempt(i, strokes=[line()]) { const value=createAttempt(strokes,null); return {...value,attemptId:`a-${i}`,createdAt:i}; }
test('twenty attempts produce the requested normalized batch schema',()=>{
  const result=analyzeBatch(Array.from({length:20},(_,i)=>attempt(i)));
  assert.equal(result.phaseId,'level_0_line_control'); assert.equal(result.totalStrokes,20);
  assert.equal(result.strokeBatch.length,20); assert.equal(result.strokeBatch[0].attemptIndex,1);
  assert.equal(result.strokeBatch[0].fragmentationCount,1); assert.equal(result.strokeBatch[0].points[0].x,.15);
  assert.equal(result.attemptSummaries.length,20); assert.equal(result.attemptSummaries[0].pointCount,51);
  assert.equal(result.attemptSummaries[0].durationMs,500); assert.equal(result.attemptSummaries[0].metrics.wobble,0);
  assert.ok(Math.abs(result.attemptSummaries[0].motion.averageSpeed-1.4)<1e-10);
  assert.equal(result.attemptSummaries[0].motion.pauseCount,0);
  assert.deepEqual(result.attemptSummaries[0].motion.wobbleBySection,{start:0,middle:0,end:0});
});
test('a problem must recur in at least 35 percent of attempts to be called a habit',()=>{
  const fragmented=(i)=>attempt(i,[line(.15,.49),line(.51,.85)]);
  const repeated=[...Array.from({length:7},(_,i)=>fragmented(i)),...Array.from({length:13},(_,i)=>attempt(i+7))];
  assert.equal(analyzeBatch(repeated).dominantHabit,'extraStrokes');
  const occasional=[...Array.from({length:6},(_,i)=>fragmented(i)),...Array.from({length:14},(_,i)=>attempt(i+6))];
  assert.equal(analyzeBatch(occasional).dominantHabit,null);
});
test('one extreme outlier does not become a habitual deviation',()=>{
  const records=[attempt(0,[line(.15,.85,.9)]),...Array.from({length:19},(_,i)=>attempt(i+1))];
  const result=analyzeBatch(records);
  assert.equal(result.metrics.deviation.exceededFrequency,.05);
  assert.notEqual(result.dominantHabit,'deviation');
});
