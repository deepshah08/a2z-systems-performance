/* ==========================================================================
   Systems Performance, Flame by Flame — CPU Scheduling & Microarchitecture
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 00. Hero: Systems Performance Observatory & Queue Saturation Arena
   * -------------------------------------------------------------------------- */
  OS.register('perfHero', function (host) {
    let utilization = 70; // %
    let arrivalRate = 700; // ops/sec
    let serviceRate = 1000; // ops/sec capacity
    let queueLength = 2.3;
    let avgWaitMs = 3.3;

    function calcMetrics() {
      const rho = utilization / 100;
      if (rho >= 0.99) {
        queueLength = 99;
        avgWaitMs = 100;
      } else {
        // M/M/1 Queueing theory formula: Lq = rho^2 / (1 - rho), Wq = Lq / lambda
        queueLength = (rho * rho) / (1 - rho);
        const wSec = queueLength / arrivalRate;
        avgWaitMs = (wSec * 1000).toFixed(1);
      }
      render();
    }

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.slider(controls, {
      label: 'Resource Utilization (% rho)',
      min: 10,
      max: 98,
      step: 2,
      value: utilization,
      onChange: (v) => {
        utilization = parseFloat(v);
        arrivalRate = Math.round((utilization / 100) * serviceRate);
        calcMetrics();
      }
    });

    OS.button(controls, 'Inject Traffic Spike (95% Load)', () => {
      utilization = 95;
      arrivalRate = 950;
      calcMetrics();
    }, { primary: true });

    OS.button(controls, 'Normal Baseline (50% Load)', () => {
      utilization = 50;
      arrivalRate = 500;
      calcMetrics();
    });

    cv = OS.canvas(host, {
      height: 260,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('The Law of Queueing: Exponential Latency Knee & Resource Saturation', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = utilization > 80 ? OS.C.red : (utilization > 60 ? OS.C.amber : OS.C.green);
        ctx.fillText(`Utilization rho = ${utilization}% | Mean Queue Depth: ${queueLength.toFixed(1)} tasks | P99 Wait: ${avgWaitMs}ms`, 16, 46);

        // Draw Queueing Curve
        const plotX = 40;
        const plotY = 65;
        const plotW = Math.min(360, w - 80);
        const plotH = 150;

        ctx.strokeStyle = OS.C.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotX, plotY);
        ctx.lineTo(plotX, plotY + plotH);
        ctx.lineTo(plotX + plotW, plotY + plotH);
        ctx.stroke();

        // Axis labels
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('0%', plotX, plotY + plotH + 16);
        ctx.fillText('50%', plotX + plotW * 0.5 - 10, plotY + plotH + 16);
        ctx.fillText('80%', plotX + plotW * 0.8 - 10, plotY + plotH + 16);
        ctx.fillText('100% Util', plotX + plotW - 35, plotY + plotH + 16);
        ctx.fillText('Wait Latency ->', plotX - 30, plotY - 8);

        // Plot curve: Lq = rho^2 / (1 - rho)
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let u = 0; u <= 95; u += 2) {
          const r = u / 100;
          const q = (r * r) / (1 - r);
          const px = plotX + (u / 100) * plotW;
          const py = plotY + plotH - Math.min(plotH, (q / 20) * plotH);
          if (u === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Current point marker
        const currX = plotX + (utilization / 100) * plotW;
        const currY = plotY + plotH - Math.min(plotH, (queueLength / 20) * plotH);

        ctx.fillStyle = utilization > 80 ? OS.C.red : OS.C.accent;
        ctx.beginPath();
        ctx.arc(currX, currY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Right side: USE Method card
        const cardX = plotX + plotW + 20;
        if (cardX + 160 <= w) {
          ctx.fillStyle = OS.rgba(OS.C.accent, 0.08);
          ctx.strokeStyle = OS.C.border;
          ctx.beginPath();
          ctx.roundRect(cardX, plotY, w - cardX - 16, plotH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(11, 'mono', 700);
          ctx.fillText("Brendan Gregg's USE Method", cardX + 10, plotY + 22);
          ctx.font = OS.font(10, 'sans', 400);
          ctx.fillStyle = OS.C.ink;
          ctx.fillText('• Utilization: % busy time', cardX + 10, plotY + 46);
          ctx.fillText('• Saturation: Queue depth', cardX + 10, plotY + 70);
          ctx.fillText('• Errors: Device / dropped events', cardX + 10, plotY + 94);

          ctx.font = OS.font(9, 'mono', 500);
          ctx.fillStyle = utilization > 75 ? OS.C.red : OS.C.green;
          ctx.fillText(utilization > 75 ? '⚠️ Saturation Detected!' : '✓ Latency in Linear Region', cardX + 10, plotY + 125);
        }
      }
    });
    calcMetrics();
  });

  /* --------------------------------------------------------------------------
   * 01. Completely Fair Scheduler (CFS) & vruntime Red-Black Tree
   * -------------------------------------------------------------------------- */
  OS.register('cfsScheduler', function (host) {
    let tasks = [
      { pid: 101, name: 'worker_A', nice: 0, weight: 1024, vruntime: 120 },
      { pid: 102, name: 'worker_B', nice: 0, weight: 1024, vruntime: 110 },
      { pid: 103, name: 'batch_job', nice: 10, weight: 110, vruntime: 145 },
      { pid: 104, name: 'realtime_ui', nice: -5, weight: 3121, vruntime: 85 }
    ];
    let schedLog = 'CFS Red-Black Tree: Leftmost task with lowest vruntime is scheduled next.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Tick CFS Scheduler (Run Leftmost Task)', () => {
      // Find leftmost (minimum vruntime)
      tasks.sort((a, b) => a.vruntime - b.vruntime);
      const runner = tasks[0];
      // vruntime delta = delta_exec * (NICE_0_LOAD / task_weight)
      const deltaExec = 10; // ms
      const vruntimeDelta = Math.round(deltaExec * (1024 / runner.weight));
      runner.vruntime += vruntimeDelta;

      schedLog = `TICK: Scheduled ${runner.name} (PID ${runner.pid}, nice ${runner.nice}). Ran 10ms. vruntime += ${vruntimeDelta} ➔ ${runner.vruntime}. Reinserted into RB-tree.`;
      // Re-sort
      tasks.sort((a, b) => a.vruntime - b.vruntime);
      render();
    }, { primary: true });

    OS.button(controls, 'Add High-Priority Worker (Nice -10)', () => {
      const minV = Math.min(...tasks.map(t => t.vruntime));
      tasks.push({
        pid: 100 + tasks.length + 1,
        name: `vip_proc_${tasks.length}`,
        nice: -10,
        weight: 9548,
        vruntime: minV // set to min_vruntime to prevent starving others
      });
      schedLog = 'NEW TASK: High-weight task initialized with current min_vruntime to prevent latency freeze.';
      tasks.sort((a, b) => a.vruntime - b.vruntime);
      render();
    });

    OS.button(controls, 'Reset CFS State', () => {
      tasks = [
        { pid: 101, name: 'worker_A', nice: 0, weight: 1024, vruntime: 120 },
        { pid: 102, name: 'worker_B', nice: 0, weight: 1024, vruntime: 110 },
        { pid: 103, name: 'batch_job', nice: 10, weight: 110, vruntime: 145 },
        { pid: 104, name: 'realtime_ui', nice: -5, weight: 3121, vruntime: 85 }
      ];
      tasks.sort((a, b) => a.vruntime - b.vruntime);
      schedLog = 'CFS Red-Black tree reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Linux CFS Scheduler: Red-Black Tree Runqueue Ordered by vruntime', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = schedLog.includes('TICK') ? OS.C.accent : OS.C.green;
        ctx.fillText(schedLog, 16, 46);

        // Render sorted runqueue boxes
        const cardW = Math.min(130, (w - 48) / tasks.length);
        const cardH = 110;
        const startY = 75;

        tasks.forEach((t, idx) => {
          const cx = 16 + idx * (cardW + 12);
          const isLeftmost = idx === 0;

          ctx.fillStyle = isLeftmost ? OS.rgba(OS.C.accent, 0.2) : OS.rgba(OS.C.muted, 0.08);
          ctx.strokeStyle = isLeftmost ? OS.C.accent : OS.C.border;
          ctx.lineWidth = isLeftmost ? 2.5 : 1;
          ctx.beginPath();
          ctx.roundRect(cx, startY, cardW, cardH, 6);
          ctx.fill();
          ctx.stroke();

          // Header
          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(11, 'mono', 700);
          ctx.fillText(t.name, cx + 8, startY + 22);

          ctx.font = OS.font(10, 'sans', 500);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(`PID: ${t.pid}`, cx + 8, startY + 42);
          ctx.fillText(`Nice: ${t.nice} (W:${t.weight})`, cx + 8, startY + 62);

          ctx.fillStyle = isLeftmost ? OS.C.accent : OS.C.ink;
          ctx.font = OS.font(10, 'mono', 600);
          ctx.fillText(`vr: ${t.vruntime} ms`, cx + 8, startY + 84);

          if (isLeftmost) {
            ctx.fillStyle = OS.C.accent;
            ctx.font = OS.font(9, 'mono', 700);
            ctx.fillText('★ NEXT RUN', cx + 8, startY + 102);
          }
        });

        // Footnote
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('vruntime formula: vruntime += delta_exec * (1024 / task_weight). Higher priority grows vruntime slower.', 16, h - 16);
      }
    });
    tasks.sort((a, b) => a.vruntime - b.vruntime);
    render();
  });

  /* --------------------------------------------------------------------------
   * 02. Context Switching Latency, Runqueues & CPU Affinity
   * -------------------------------------------------------------------------- */
  OS.register('contextSwitch', function (host) {
    let voluntary = 120;
    let involuntary = 450;
    let switchType = 'PROCESS'; // 'THREAD' vs 'PROCESS'
    let latencyNs = 1450;
    let statusText = 'Process Context Switch: Swapping CR3 register invalidates non-global TLB entries, causing L1/L2 cache misses!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Switch Type', [
      { value: 'PROCESS', label: 'Heavy Process Context Switch (CR3 Page Directory Swap)' },
      { value: 'THREAD', label: 'Light Thread Context Switch (Same Virtual Memory Address Space)' },
      { value: 'AFFINITY_MIGRATION', label: 'Cross-CPU NUMA Core Migration (Cache Cold Penalty)' }
    ], (val) => {
      switchType = val;
      if (val === 'PROCESS') {
        latencyNs = 1450;
        statusText = 'Process switch: Full CR3 register reload + TLB invalidation + L1/L2 D-Cache cold misses.';
      } else if (val === 'THREAD') {
        latencyNs = 380;
        statusText = 'Thread switch: Shares mm_struct. Registers & stack pointer saved; TLB preserved!';
      } else {
        latencyNs = 4800;
        statusText = 'Core Migration: Task moved to different CPU socket! Complete L1/L2/L3 cache misses across interconnect.';
      }
      render();
    });

    OS.button(controls, 'Trigger Involuntary Preemption', () => {
      involuntary += 100;
      statusText = `Preemption occurred: Time quantum expired. Kernel invoked schedule() involuntarily.`;
      render();
    }, { primary: true });

    OS.button(controls, 'Trigger Voluntary Sleep (I/O Wait)', () => {
      voluntary += 100;
      statusText = `Voluntary yield: Process blocked on read() / epoll_wait() system call.`;
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Hardware Context Switch Architecture: Cost Breakdown & Register State`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = latencyNs > 2000 ? OS.C.red : (latencyNs > 1000 ? OS.C.amber : OS.C.green);
        ctx.fillText(statusText, 16, 46);

        // Stages breakdown
        const boxW = Math.min(160, (w - 60) / 3);
        const boxH = 100;
        const startY = 80;

        // Stage 1: CPU Registers
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(16, startY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('1. Register Save', 26, startY + 24);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText('• RIP, RSP, RBP', 26, startY + 45);
        ctx.fillText('• General Regs (RAX..)', 26, startY + 65);
        ctx.fillText('• Kernel Stack Frame', 26, startY + 85);

        // Stage 2: Memory Management
        const x2 = 16 + boxW + 16;
        const isProc = switchType !== 'THREAD';
        ctx.fillStyle = isProc ? OS.rgba(OS.C.amber, 0.15) : OS.rgba(OS.C.muted, 0.05);
        ctx.strokeStyle = isProc ? OS.C.amber : OS.C.border;
        ctx.beginPath();
        ctx.roundRect(x2, startY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('2. Address Space', x2 + 10, startY + 24);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = isProc ? OS.C.amber : OS.C.muted;
        ctx.fillText(isProc ? '• Swap CR3 Register' : '• Reused mm_struct', x2 + 10, startY + 45);
        ctx.fillText(isProc ? '• TLB Flush / PCID' : '• TLB Retained (No Flush)', x2 + 10, startY + 65);
        ctx.fillText(isProc ? '• Cache Pollution' : '• Fast Cache Continuity', x2 + 10, startY + 85);

        // Stage 3: Latency & Stats
        const x3 = x2 + boxW + 16;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.12);
        ctx.strokeStyle = OS.C.teal;
        ctx.beginPath();
        ctx.roundRect(x3, startY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('3. Total Latency', x3 + 10, startY + 24);
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillStyle = OS.C.teal;
        ctx.fillText(`${latencyNs} ns`, x3 + 10, startY + 50);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Voluntary: ${voluntary}/s`, x3 + 10, startY + 70);
        ctx.fillText(`Involuntary: ${involuntary}/s`, x3 + 10, startY + 88);

        // Footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('/proc/PID/status metrics: voluntary_ctxt_switches & nonvoluntary_ctxt_switches', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 03. Hardware Performance Counters (PMU) & Topdown Analysis
   * -------------------------------------------------------------------------- */
  OS.register('perfCounters', function (host) {
    let ipc = 1.4; // Instructions Per Cycle
    let frontendBound = 15; // %
    let badSpeculation = 8;
    let backendBound = 52; // memory/execution stalls
    let retiring = 25; // useful work

    let profileMode = 'MEMORY_BOUND'; // 'COMPUTE_BOUND' vs 'MEMORY_BOUND' vs 'BRANCH_MISS'

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Workload Bottleneck', [
      { value: 'MEMORY_BOUND', label: 'DRAM Cache Miss Bottleneck (Backend Bound)' },
      { value: 'BRANCH_MISS', label: 'Branch Prediction Failure (Bad Speculation)' },
      { value: 'COMPUTE_BOUND', label: 'Optimized Matrix Math (High Retiring / IPC > 2)' }
    ], (val) => {
      profileMode = val;
      if (val === 'MEMORY_BOUND') {
        ipc = 0.55;
        frontendBound = 10;
        badSpeculation = 5;
        backendBound = 70;
        retiring = 15;
      } else if (val === 'BRANCH_MISS') {
        ipc = 0.75;
        frontendBound = 20;
        badSpeculation = 45;
        backendBound = 20;
        retiring = 15;
      } else {
        ipc = 2.4;
        frontendBound = 10;
        badSpeculation = 5;
        backendBound = 20;
        retiring = 65;
      }
      render();
    });

    OS.button(controls, 'Profile with perf stat', () => {
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Topdown Microarchitecture Analysis: PMU Cycles Breakdown (Ahmad Yasin Method)`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = ipc < 1.0 ? OS.C.red : OS.C.green;
        ctx.fillText(`IPC = ${ipc} instructions/cycle | Primary Bottleneck: ${profileMode}`, 16, 46);

        // Stacked Bar Chart of Pipeline Slots
        const barX = 16;
        const barY = 75;
        const barW = Math.min(500, w - 32);
        const barH = 36;

        const wRetiring = (retiring / 100) * barW;
        const wBadSpec = (badSpeculation / 100) * barW;
        const wFrontend = (frontendBound / 100) * barW;
        const wBackend = barW - (wRetiring + wBadSpec + wFrontend);

        // Retiring (Green)
        ctx.fillStyle = OS.C.green;
        ctx.fillRect(barX, barY, wRetiring, barH);

        // Bad Speculation (Amber)
        ctx.fillStyle = OS.C.amber;
        ctx.fillRect(barX + wRetiring, barY, wBadSpec, barH);

        // Frontend Bound (Accent Blue)
        ctx.fillStyle = OS.C.accent;
        ctx.fillRect(barX + wRetiring + wBadSpec, barY, wFrontend, barH);

        // Backend Bound (Red)
        ctx.fillStyle = OS.C.red;
        ctx.fillRect(barX + wRetiring + wBadSpec + wFrontend, barY, wBackend, barH);

        // Labels underneath
        const legendY = barY + barH + 25;
        ctx.font = OS.font(10, 'mono', 600);

        ctx.fillStyle = OS.C.green;
        ctx.fillText(`■ Retiring: ${retiring}%`, barX, legendY);

        ctx.fillStyle = OS.C.amber;
        ctx.fillText(`■ Bad Speculation: ${badSpeculation}%`, barX + 130, legendY);

        ctx.fillStyle = OS.C.accent;
        ctx.fillText(`■ Frontend Bound: ${frontendBound}%`, barX + 280, legendY);

        ctx.fillStyle = OS.C.red;
        ctx.fillText(`■ Backend Bound: ${backendBound}%`, barX + 430, legendY);

        // Guidance text
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(profileMode === 'MEMORY_BOUND' 
          ? 'Backend Bound: CPU cores stalled waiting for LLC / DRAM memory loads. Optimize cache locality!' 
          : (profileMode === 'BRANCH_MISS' ? 'Bad Speculation: Pipeline flushes from unpredictable if/else branches. Use branchless code!' : 'Retiring > 60%: Near-optimal microarchitecture utilization.'),
          barX, legendY + 30);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 04. Linux CPU Throttling: CFS Bandwidth Control & cgroups v2
   * -------------------------------------------------------------------------- */
  OS.register('cfsThrottling', function (host) {
    let quotaMs = 50; // out of 100ms period (0.5 CPU)
    let periodMs = 100;
    let threadDemandMs = 80; // wants 80ms per 100ms period
    let throttledMs = 30; // 80 - 50 = 30ms latency spike
    let throttledEvents = 14;

    function recalc() {
      throttledMs = Math.max(0, threadDemandMs - quotaMs);
      render();
    }

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.slider(controls, {
      label: 'cgroup cpu.max Quota (ms / 100ms)',
      min: 20,
      max: 100,
      step: 10,
      value: quotaMs,
      onChange: (v) => { quotaMs = parseFloat(v); recalc(); }
    });

    OS.slider(controls, {
      label: 'Application CPU Demand (ms / 100ms)',
      min: 20,
      max: 100,
      step: 10,
      value: threadDemandMs,
      onChange: (v) => { threadDemandMs = parseFloat(v); recalc(); }
    });

    OS.button(controls, 'Simulate Bursty Workload', () => {
      threadDemandMs = 100;
      throttledEvents += 5;
      recalc();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Linux cgroups v2 CFS Bandwidth Control & Container Throttling (cpu.stat)', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = throttledMs > 0 ? OS.C.red : OS.C.green;
        ctx.fillText(`Period: 100ms | Quota: ${quotaMs}ms | Demand: ${threadDemandMs}ms | Throttled Stall: ${throttledMs}ms!`, 16, 46);

        // Timeline visualization of 100ms period
        const timeX = 16;
        const timeY = 75;
        const timeW = Math.min(500, w - 32);
        const timeH = 40;

        const activeW = (Math.min(threadDemandMs, quotaMs) / 100) * timeW;
        const throttledW = (throttledMs / 100) * timeW;
        const idleW = timeW - (activeW + throttledW);

        // Active execution
        ctx.fillStyle = OS.C.green;
        ctx.fillRect(timeX, timeY, activeW, timeH);

        // Throttled frozen
        if (throttledW > 0) {
          ctx.fillStyle = OS.C.red;
          ctx.fillRect(timeX + activeW, timeY, throttledW, timeH);
        }

        // Unused quota
        if (idleW > 0) {
          ctx.fillStyle = OS.rgba(OS.C.muted, 0.15);
          ctx.fillRect(timeX + activeW + throttledW, timeY, idleW, timeH);
        }

        // Timeline labels
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('0 ms', timeX, timeY + timeH + 18);
        ctx.fillText(`${quotaMs} ms (QUOTA EXHAUSTED)`, timeX + (quotaMs / 100) * timeW - 50, timeY + timeH + 18);
        ctx.fillText('100 ms (PERIOD END)', timeX + timeW - 80, timeY + timeH + 18);

        // Legend & container diagnosis
        const diagY = timeY + timeH + 42;
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = throttledMs > 0 ? OS.C.red : OS.C.green;
        ctx.fillText(throttledMs > 0 
          ? `⚠️ CPU THROT_CNT: Container hard-frozen for ${throttledMs}ms of this 100ms slice! Tail latency p99 balloons by ${throttledMs}ms.`
          : '✓ NO THROTTLING: Application CPU demand fits within assigned quota.', 16, diagY);

        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Diagnosis metric: /sys/fs/cgroup/cpu.stat -> nr_throttled & throttled_usec', 16, h - 16);
      }
    });
    recalc();
  });

})();
