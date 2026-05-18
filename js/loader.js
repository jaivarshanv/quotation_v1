/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — loader.js
   Animated loading stage indicator
   ═══════════════════════════════════════════════════ */

'use strict';

const LOADER_STAGES = [
  ['Parsing input data', 'Extracting quantities, materials, and specifications'],
  ['Sourcing material rates', 'Applying Apex raw-material pricing benchmarks'],
  ['Calculating fabrication', 'Assigning shop hourly factors and weld complexity'],
  ['Computing logistics', 'Routing truckloads from processing facility to delivery'],
  ['Finalising quote', 'Generating detailed line-item breakdown'],
];

let _stageIdx = 0;
let _stageTimer = null;

function startLoader() {
  _stageIdx = 0;
  const loader = document.getElementById('loader');
  loader.classList.add('active');

  const output = document.getElementById('quoteOutput');
  output.classList.remove('visible');

  function tick() {
    if (_stageIdx < LOADER_STAGES.length) {
      const [stage, sub] = LOADER_STAGES[_stageIdx];
      document.getElementById('loaderStage').textContent = stage;
      document.getElementById('loaderSub').textContent = sub;
      _stageIdx++;
      _stageTimer = setTimeout(tick, 1100);
    }
  }
  tick();
}

function stopLoader() {
  clearTimeout(_stageTimer);
  document.getElementById('loader').classList.remove('active');
}

window.startLoader = startLoader;
window.stopLoader = stopLoader;
