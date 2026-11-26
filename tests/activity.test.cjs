const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/activity.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
test('activity time handles missing/future timestamps and minute/hour/day boundaries',()=>{const now=Date.parse('2026-11-11T12:00:00Z');for(const [age,result]of [[0,'now'],[60,'1m'],[3600,'1h'],[86400,'1d'],[604800,'1w'],[-60,'now']])assert.equal(mod.exports.activityTime(new Date(now-age*1000).toISOString(),now),result);assert.equal(mod.exports.activityTime('invalid',now),'');});

test('time sections follow local calendar days: today, yesterday, then 7 and 30 days back', () => {
  const now = new Date(2026, 10, 24, 10, 0, 0).getTime();
  const at = (days, hours = 12) => new Date(2026, 10, 24 - days, hours, 0, 0).toISOString();
  const bucket = mod.exports.timeBucket;
  assert.equal(bucket(at(0, 0), now), 'today');
  assert.equal(bucket(at(1, 23), now), 'yesterday');
  assert.equal(bucket(at(1, 0), now), 'yesterday');
  assert.equal(bucket(at(3), now), 'week');
  assert.equal(bucket(at(20), now), 'month');
  assert.equal(bucket(at(45), now), 'older');
  assert.equal(bucket(null, now), 'older');
});
