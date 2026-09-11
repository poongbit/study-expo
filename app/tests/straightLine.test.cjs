require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeLine, analyzePressure, createAttempt, compareAttempts, parseAttempt, validateStrokes } = require('../src/basics/straightLine.ts');
const { LINE_GUIDES } = require('../src/basics/lineExercises.ts');
const { validateDrawing } = require('../src/ml/validateDrawing.ts');
function stroke(coords, inputType = 'TOUCH') {
  return { strokeId: 'test', inputType, startedAt: 100, points: coords.map(([x,y], i) => ({ x,y,t:i*10 })) };
}
const ideal = () => [stroke(Array.from({length: 101}, (_, i) => [0.15 + 0.7 * i / 100, 0.5]))];
test('practice rotation covers both directions on every line axis', () => {
  assert.equal(LINE_GUIDES.length, 8);
  assert.deepEqual(new Set(LINE_GUIDES.map(guide => guide.id)), new Set([
    'horizontal-right', 'horizontal-left', 'vertical-down', 'vertical-up',
    'diagonal-down', 'diagonal-up-left', 'diagonal-up', 'diagonal-down-left',
  ]));
});
test('ideal line is within exercise targets', () => {
  const a = analyzeLine(ideal());
  assert.equal(a.correction, null);
  assert.deepEqual(a.metrics, { endpoints: 0, deviation: 0, extraStrokes: 0, wobble: 0, backtracking: 0 });
});
test('empty, tap, tiny, nonfinite, out-of-canvas and backwards timestamps are invalid', () => {
  for (const data of [[], [stroke([[0.5,0.5]])], [stroke([[0.5,0.5],[0.501,0.5]])], [stroke([[NaN,0.5],[0.85,0.5]])], [stroke([[-1,0.5],[0.85,0.5]])]]) {
    assert.ok(validateStrokes(data)); assert.throws(() => analyzeLine(data));
  }
  const data = ideal(); data[0].points[2].t = -1;
  assert.ok(validateStrokes(data));
});
test('stopping short and drawing in reverse trigger endpoint correction', () => {
  assert.equal(analyzeLine([stroke([[0.15,0.5],[0.3,0.5]])]).correction, 'endpoints');
  assert.equal(analyzeLine([stroke([[0.85,0.5],[0.15,0.5]])]).correction, 'backtracking');
});
test('arched line selects deviation; fragmented line selects extra strokes', () => {
  assert.equal(analyzeLine([stroke([[0.15,0.5],[0.5,0.8],[0.85,0.5]])]).correction, 'deviation');
  assert.equal(analyzeLine([stroke([[0.15,0.5],[0.5,0.5]]),stroke([[0.5,0.5],[0.85,0.5]])]).correction, 'extraStrokes');
});
test('repeating samples while stationary cannot change deviation', () => {
  const sparse = stroke([[0.15,0.5],[0.5,0.7],[0.85,0.5]]);
  const dense = stroke([[0.15,0.5], ...Array.from({length: 100}, () => [0.5,0.7]), [0.85,0.5]]);
  assert.ok(Math.abs(analyzeLine([sparse]).metrics.deviation - analyzeLine([dense]).metrics.deviation) < 1e-10);
});
test('subdividing a segment crossing the guide preserves geometric distance', () => {
  const a = analyzeLine([stroke([[0.15,0.4],[0.85,0.6]])]);
  const b = analyzeLine([stroke([[0.15,0.4],[0.5,0.5],[0.85,0.6]])]);
  assert.ok(Math.abs(a.metrics.deviation - b.metrics.deviation) < 1e-10);
});
test('retry compares previous correction even when new primary correction changes', () => {
  const before = createAttempt([stroke([[0.15,0.5],[0.5,0.8],[0.85,0.5]])], null);
  const after = createAttempt([stroke([[0.15,0.5],[0.5,0.5]]), stroke([[0.5,0.5],[0.85,0.5]])], before);
  assert.equal(after.previousAttemptId, before.attemptId);
  assert.equal(after.analysis.correction, 'extraStrokes');
  assert.match(compareAttempts(before, after), /가이드에서 벗어난 정도.*오차가 줄었어요/);
});
test('retry reports worse and unchanged outcomes without dividing by zero', () => {
  const before = createAttempt([stroke([[0.15,0.5],[0.5,0.7],[0.85,0.5]])], null);
  const after = createAttempt([stroke([[0.15,0.5],[0.5,0.9],[0.85,0.5]])], before);
  assert.match(compareAttempts(before, after), /늘었어요/);
  assert.match(compareAttempts(before, before), /비슷해요/);
  const good = createAttempt(ideal(), null);
  assert.match(compareAttempts(good, good), /두 기록/);
});
test('changed input tools, mixed strokes or metric versions are not compared', () => {
  const before = createAttempt(ideal(), null);
  const pen = createAttempt([stroke([[0.15,0.5],[0.85,0.5]], 'STYLUS')], before);
  assert.match(compareAttempts(before, pen), /입력 도구/);
  const mixed = createAttempt([...ideal(), stroke([[0.15,0.5],[0.85,0.5]], 'STYLUS')], before);
  assert.equal(mixed.inputType, 'MIXED');
  assert.match(compareAttempts(mixed, mixed), /입력 도구/);
  assert.match(compareAttempts({...before, metricVersion: 1}, before), /기준이 달라/);
});
test('snapshot retains independent raw strokes and roundtrips via persisted JSON', () => {
  const strokes = ideal();
  const attempt = createAttempt(strokes, null);
  strokes[0].points[0].x = 0;
  assert.equal(attempt.strokes[0].points[0].x, 0.15);
  assert.deepEqual(parseAttempt(JSON.stringify(attempt)), attempt);
});
test('corrupt or unsupported records rejected; cached analysis re-derived from strokes', () => {
  const attempt = createAttempt(ideal(), null);
  for (const value of [null, {}, {...attempt, metricVersion: 99}, {...attempt, strokes: []}, {...attempt, inputType: 'MIXED'}, {...attempt, attemptId: '../bad'}])
    assert.throws(() => parseAttempt(JSON.stringify(value)));
  assert.equal(parseAttempt(JSON.stringify({...attempt, analysis: null})).analysis.correction, null);
});
test('legacy chibi analysis rejects empty/missing/degenerate parts before detection', () => {
  const data = {drawingId:'test', inputType:'TOUCH', parts:{head:[],eye_left:[],eye_right:[],torso:[]}};
  assert.ok(validateDrawing(data));
  const shape = [stroke([[0.2,0.2],[0.5,0.2],[0.5,0.5],[0.2,0.5]])];
  for (const key of Object.keys(data.parts)) data.parts[key] = shape;
  assert.equal(validateDrawing(data), null);
  data.parts.head = [stroke([[0.2,0.2],[0.5,0.2]])];
  assert.ok(validateDrawing(data));
});

const wave = (amplitude = 0.005, cycles = 6, count = 241) => [stroke(Array.from({length: count}, (_, i) => [0.15 + 0.7 * i / (count - 1), 0.5 + amplitude * Math.sin(2 * Math.PI * cycles * i / (count - 1))]))];
test('regression: small repeated waves pass v1 distance checks but trigger v2 wobble coaching', () => {
  const a = createAttempt(wave(), null);
  assert.ok(a.analysis.metrics.deviation < 0.015);
  assert.ok(a.analysis.metrics.endpoints < 0.00001);
  assert.equal(a.analysis.correction, 'wobble');
  assert.equal(a.analysis.samplingNote, undefined);
  assert.match(a.analysis.feedback, /화면에 닿지 않게/);
  const old = parseAttempt(JSON.stringify({...a, metricVersion: 1, guide:{start:{x:.15,y:.5},end:{x:.85,y:.5}}}));
  assert.equal(old.metricVersion, 1);
  assert.equal(old.analysis.correction, null);
  assert.match(compareAttempts(old, a), /기준이 달라/);
});
test('vertical and diagonal guides use their own forward and lateral axes', () => {
  const vertical = LINE_GUIDES[1];
  const straight = [stroke(Array.from({length:101},(_,i)=>[.5,.15+.7*i/100]))];
  assert.equal(analyzeLine(straight,vertical).correction,null);
  const diagonal = LINE_GUIDES[2];
  const reversed=[stroke([[.22,.22],[.7,.7],[.45,.45],[.78,.78]])];
  assert.equal(analyzeLine(reversed,diagonal).correction,'backtracking');
});
test('pressure exercises evaluate Pencil samples and defer unsupported touch input', () => {
  const pencil=[stroke(Array.from({length:30},(_,i)=>[.15+.7*i/29,.5]),'STYLUS')];
  pencil[0].points.forEach(p=>p.pressure=.3);
  assert.equal(analyzePressure(pencil,'steady').achieved,true);
  pencil[0].points.forEach((p,i)=>p.pressure=.1+.5*i/29);
  assert.equal(analyzePressure(pencil,'increase',.3).achieved,true);
  assert.equal(analyzePressure(pencil,'increase').available,false);
  assert.equal(analyzePressure(ideal(),'steady').available,false);
  const saved=createAttempt(pencil,null,{guide:LINE_GUIDES[1],pressureTask:'increase',pressureBaseline:.3});
  assert.deepEqual(parseAttempt(JSON.stringify(saved)),saved);
});
test('smooth tilted stroke and a single broad arc are distinct from repeated wobble', () => {
  const tilted = analyzeLine([stroke(Array.from({length:101}, (_,i) => [0.15 + 0.7*i/100, 0.495 + 0.01*i/100]))]);
  assert.ok(tilted.metrics.wobble < 1e-10);
  const arc = analyzeLine([stroke(Array.from({length:101}, (_,i) => [0.15 + 0.7*i/100, 0.5 + 0.03*Math.sin(Math.PI*i/100)]))]);
  assert.ok(arc.metrics.wobble < 1e-10);
  assert.equal(arc.correction, 'deviation');
});
test('small sensor noise does not accumulate into a wobble correction', () => {
  const a = analyzeLine(wave(0.0005, 40, 801));
  assert.equal(a.correction, null);
  assert.ok(a.metrics.wobble < 1e-10);
});
test('wobble measurement stays stable under denser samples and stationary duplicates', () => {
  const sparse = analyzeLine(wave(0.005,6,241));
  const dense = analyzeLine(wave(0.005,6,961));
  assert.ok(Math.abs(sparse.metrics.wobble - dense.metrics.wobble) < 0.003);
  const repeated = wave();
  repeated[0].points = repeated[0].points.flatMap(p => Array.from({length:5}, () => ({...p})));
  assert.ok(Math.abs(analyzeLine(repeated).metrics.wobble - sparse.metrics.wobble) < 1e-10);
});
test('backtracking within a single continuous stroke is detected', () => {
  const a = analyzeLine([stroke([[0.15,0.5],[0.6,0.5],[0.4,0.5],[0.85,0.5]])]);
  assert.equal(a.correction, 'backtracking');
  assert.ok(a.metrics.backtracking > 0.28);
});
test('flow correction takes priority over endpoint accuracy', () => {
  const data = wave();
  data[0].points = data[0].points.map(p => ({...p, x:p.x + 0.08}));
  const a = analyzeLine(data);
  assert.ok(a.metrics.endpoints > 0.025);
  assert.equal(a.correction, 'wobble');
});
test('sparse input never receives blanket success or a confident wobble comparison', () => {
  const a = createAttempt([stroke([[0.15,0.5],[0.85,0.5]])], null);
  assert.ok(a.analysis.samplingNote);
  assert.match(a.analysis.feedback, /판단하기 어려워/);
  assert.match(compareAttempts(a,a), /비교는 보류/);
});
test('retry measures reduced wobble even if a geometry correction becomes primary', () => {
  const before = createAttempt(wave(),null);
  const afterData = ideal();
  afterData[0].points = afterData[0].points.map(p => ({...p,y:p.y+0.02}));
  const after = createAttempt(afterData,before);
  assert.equal(after.analysis.correction,'deviation');
  assert.match(compareAttempts(before,after), /반복 흔들림.*오차가 줄었어요/);
});
