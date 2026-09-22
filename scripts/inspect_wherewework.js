import fs from 'fs';

const content = fs.readFileSync('wherewework_bundle.js', 'utf8');

// Find _U() definition and wherewework-api.fly.dev context
const idx = content.indexOf('wherewework-api.fly.dev');
if (idx !== -1) {
  console.log('Context around wherewework-api.fly.dev:');
  console.log(content.slice(Math.max(0, idx - 200), idx + 400));
}

// Find p0 definition
const p0Idx = content.indexOf('function p0(') !== -1 ? content.indexOf('function p0(') : content.indexOf('p0=');
console.log('\np0 search:');
if (p0Idx !== -1) {
  console.log(content.slice(p0Idx, p0Idx + 300));
}

// Search for city list
const cityMatches = content.match(/cities\s*=\s*\[[^\]]+\]/);
if (cityMatches) {
  console.log('\nCity matches:', cityMatches[0]);
}
