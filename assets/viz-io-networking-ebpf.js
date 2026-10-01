/* ==========================================================================
   Systems Performance, Flame by Flame — I/O, Networking & eBPF Profiling
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 09. Linux Block I/O Layer: BIOs, Request Queues & Multi-Queue (blk-mq)
   * -------------------------------------------------------------------------- */
  OS.register('blockIoQueue', function (host) {
    let scheduler = 'MQ_DEADLINE'; // 'MQ_DEADLINE', 'BFQ', 'NONE'
    let queueLength = 3;
    let mergedRequests = 12;
    let statusText = 'Multi-Queue (blk-mq): Per-CPU software staging queues dispatch to hardware dispatch queues without global lock contention.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'I/O Scheduler', [
      { value: 'MQ_DEADLINE', label: 'mq-deadline (Low latency, guarantees read/write expiration deadlines)' },
      { value: 'BFQ', label: 'BFQ (Budget Fair Queueing — Desktop interactive fairness)' },
      { value: 'NONE', label: 'none (NVMe bypass — Controller handles multi-queue scheduling)' }
    ], (val) => {
      scheduler = val;
      statusText = val === 'NONE'
        ? 'Scheduler set to "none": Direct submission from blk-mq software queues straight to NVMe hardware queues!'
        : `Scheduler set to ${val}: Merges contiguous bio structs into sequential request blocks.`;
      render();
    });

    OS.button(controls, 'Submit Contiguous 4KB BIOs (Merge)', () => {
      mergedRequests += 4;
      statusText = 'BIO MERGE: Sequential sector writes merged into single 16KB hardware command! Saves device overhead.';
      render();
    }, { primary: true });

    OS.button(controls, 'Dispatch Request to Hardware', () => {
      if (queueLength > 0) queueLength--;
      statusText = 'DISPATCH: Request submitted to NVMe Submission Queue via DMA.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Linux Block I/O Architecture: VFS ➔ blk-mq ➔ I/O Scheduler ➔ NVMe`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Architecture Pipeline
        const stages = [
          { name: '1. VFS / File System', sub: 'bio struct allocated' },
          { name: '2. blk-mq Soft Queue', sub: 'Per-CPU staging queue' },
          { name: `3. Scheduler (${scheduler})`, sub: 'Sector merge & sort' },
          { name: '4. Device HW Queue', sub: 'NVMe submission ring' }
        ];

        const boxW = Math.min(125, (w - 60) / stages.length);
        const boxH = 80;
        const startY = 80;

        stages.forEach((s, idx) => {
          const bx = 16 + idx * (boxW + 12);

          ctx.fillStyle = idx === 2 ? OS.rgba(OS.C.accent, 0.18) : OS.rgba(OS.C.muted, 0.08);
          ctx.strokeStyle = idx === 2 ? OS.C.accent : OS.C.border;
          ctx.beginPath();
          ctx.roundRect(bx, startY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(s.name, bx + 6, startY + 22);

          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(s.sub, bx + 6, startY + 45);

          if (idx < stages.length - 1) {
            ctx.strokeStyle = OS.C.muted;
            ctx.beginPath();
            ctx.moveTo(bx + boxW, startY + boxH / 2);
            ctx.lineTo(bx + boxW + 12, startY + boxH / 2);
            ctx.stroke();
          }
        });

        // Summary footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Merged BIOs: ${mergedRequests} | Fast NVMe storage devices use scheduler="none" to eliminate CPU lock overhead.`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 10. Modern High-Throughput Linux I/O: io_uring Ring Buffers
   * -------------------------------------------------------------------------- */
  OS.register('ioUringRing', function (host) {
    let sqHead = 2;
    let sqTail = 4;
    let cqHead = 1;
    let cqTail = 3;
    let totalOps = 8;
    let statusText = 'io_uring: Lockless ring buffers in memory shared between user space & kernel. Zero syscalls in polling mode!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Submit SQE (Submission Queue Entry)', () => {
      sqTail = (sqTail + 1) % 8;
      totalOps++;
      statusText = `SUBMIT: Appended write SQE to Submission Queue ring buffer at tail index ${sqTail}. No context switch!`;
      render();
    }, { primary: true });

    OS.button(controls, 'Kernel Reaps & Completes (CQE)', () => {
      sqHead = (sqHead + 1) % 8;
      cqTail = (cqTail + 1) % 8;
      statusText = `COMPLETION: Kernel reaped SQE #${sqHead} and posted CQE to Completion Queue ring buffer at index ${cqTail}.`;
      render();
    });

    OS.button(controls, 'Reset io_uring Rings', () => {
      sqHead = 0; sqTail = 0;
      cqHead = 0; cqTail = 0;
      statusText = 'Ring buffers reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('io_uring Architecture: Lockless Shared-Memory SQ & CQ Ring Buffers', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Draw Submission Queue (SQ) & Completion Queue (CQ)
        const ringW = Math.min(220, (w - 48) / 2);
        const ringH = 100;
        const startY = 75;

        // SQ Box
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(16, startY, ringW, ringH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Submission Queue (SQ)', 26, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText('User writes -> Kernel reaps', 26, startY + 44);
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = OS.C.accent;
        ctx.fillText(`Head: ${sqHead} | Tail: ${sqTail}`, 26, startY + 68);

        // CQ Box
        const x2 = 16 + ringW + 16;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.1);
        ctx.strokeStyle = OS.C.teal;
        ctx.beginPath();
        ctx.roundRect(x2, startY, ringW, ringH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 700);
        ctx.fillText('Completion Queue (CQ)', x2 + 10, startY + 22);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillText('Kernel writes -> User reads', x2 + 10, startY + 44);
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillStyle = OS.C.teal;
        ctx.fillText(`Head: ${cqHead} | Tail: ${cqTail}`, x2 + 10, startY + 68);

        // Footnote
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Total Operations Processed: ${totalOps} | Bypasses read()/write() syscall overhead entirely!`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 11. Disk Latency Profiles & eBPF biolatency Log2 Histograms
   * -------------------------------------------------------------------------- */
  OS.register('ebpfDiskLatency', function (host) {
    const buckets = [
      { range: '0 -> 1 us', count: 12 },
      { range: '2 -> 3 us', count: 85 },
      { range: '4 -> 7 us', count: 340 },
      { range: '8 -> 15 us', count: 1250 },
      { range: '16 -> 31 us', count: 3410 },
      { range: '32 -> 63 us', count: 820 },
      { range: '64 -> 127 us', count: 95 },
      { range: '128 -> 255 us', count: 14 },
      { range: '256 -> 511 us', count: 2 } // tail latency
    ];
    let logMsg = 'biolatency: eBPF measures time from block request insertion to device completion.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Inject Slow Disk Outlier (512+ us)', () => {
      buckets[buckets.length - 1].count += 5;
      logMsg = 'TAIL OUTLIER DETECTED: Hardware controller garbage collection stall triggered high latency!';
      render();
    }, { primary: true });

    OS.button(controls, 'Simulate 10,000 I/O Operations', () => {
      buckets[4].count += 1500;
      logMsg = 'Sampled 10,000 requests. Median NVMe read latency centered around 16-31 microseconds.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`eBPF biolatency: Block I/O Log2 Latency Distribution Histogram`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = logMsg.includes('OUTLIER') ? OS.C.red : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // Draw histogram bars
        const startX = 16;
        const startY = 70;
        const maxCount = Math.max(...buckets.map(b => b.count));
        const barH = 14;
        const gap = 4;
        const maxBarW = Math.min(260, w - 160);

        buckets.forEach((b, idx) => {
          const by = startY + idx * (barH + gap);

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(9, 'mono', 500);
          ctx.fillText(b.range.padEnd(14), startX, by + 10);

          const barW = Math.max(2, (b.count / maxCount) * maxBarW);
          const isOutlier = idx >= buckets.length - 2 && b.count > 0;

          ctx.fillStyle = isOutlier ? OS.C.red : OS.C.accent;
          ctx.fillRect(startX + 95, by, barW, barH);

          ctx.fillStyle = OS.C.muted;
          ctx.fillText(String(b.count), startX + 105 + barW, by + 10);
        });
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 12. Linux Network RX/TX Path: Ring Buffers, NAPI & SoftIRQs
   * -------------------------------------------------------------------------- */
  OS.register('networkNapiRing', function (host) {
    let mode = 'NAPI_POLL'; // 'INTERRUPT' vs 'NAPI_POLL'
    let rxRingPackets = 18;
    let ringCapacity = 64;
    let softIrqCpu = 12; // %
    let statusText = 'NAPI Mode: Hardware interrupt disabled after first packet; kernel polls RX ring in softirq (ksoftirqd).';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'RX Processing Mode', [
      { value: 'NAPI_POLL', label: 'NAPI Hybrid Polling (Mitigates Interrupt Storms)' },
      { value: 'INTERRUPT', label: 'Legacy Per-Packet Hardware Interrupts (Storm Risk!)' }
    ], (val) => {
      mode = val;
      if (val === 'INTERRUPT') {
        softIrqCpu = 88;
        statusText = 'INTERRUPT STORM: High packet rate causes thousands of CPU context switches into hardirq handlers!';
      } else {
        softIrqCpu = 12;
        statusText = 'NAPI: Disables IRQs during traffic bursts and drains RX ring in budget batches (default 64 packets).';
      }
      render();
    });

    OS.button(controls, 'Flood 100,000 Packets', () => {
      rxRingPackets = 55;
      if (mode === 'INTERRUPT') {
        statusText = 'PACKET LOSS: CPU saturated in interrupt handler! NIC RX ring overflowed (ethtool rx_discards)!';
      } else {
        statusText = 'NAPI PROTECTED: Softirq budget drained 64 packets per poll loop without CPU lockup.';
      }
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Linux Network Subsystem: NIC DMA Ring ➔ HardIRQ ➔ NAPI Poll ➔ SoftIRQ`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = mode === 'INTERRUPT' ? OS.C.red : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Stages
        const stages = [
          { name: '1. NIC DMA Ring', sub: `${rxRingPackets}/${ringCapacity} slots` },
          { name: '2. HardIRQ', sub: mode === 'NAPI_POLL' ? 'One-shot kick' : 'Per packet!' },
          { name: '3. NAPI Poller', sub: 'net_rx_action' },
          { name: '4. ksoftirqd', sub: `CPU: ${softIrqCpu}%` }
        ];

        const boxW = Math.min(125, (w - 60) / stages.length);
        const boxH = 75;
        const startY = 80;

        stages.forEach((s, idx) => {
          const bx = 16 + idx * (boxW + 12);

          ctx.fillStyle = idx === 3 && softIrqCpu > 50 ? OS.rgba(OS.C.red, 0.2) : OS.rgba(OS.C.accent, 0.1);
          ctx.strokeStyle = idx === 3 && softIrqCpu > 50 ? OS.C.red : OS.C.border;
          ctx.beginPath();
          ctx.roundRect(bx, startY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(s.name, bx + 6, startY + 22);

          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(s.sub, bx + 6, startY + 45);

          if (idx < stages.length - 1) {
            ctx.strokeStyle = OS.C.muted;
            ctx.beginPath();
            ctx.moveTo(bx + boxW, startY + boxH / 2);
            ctx.lineTo(bx + boxW + 12, startY + boxH / 2);
            ctx.stroke();
          }
        });

        // Summary footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Monitor via: /proc/net/softnet_stat and ethtool -S <eth0>`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 13. Socket Buffers (sk_buff) & TCP Buffer Autotuning
   * -------------------------------------------------------------------------- */
  OS.register('skBuffTuning', function (host) {
    let rttMs = 50;
    let bandwidthMbps = 1000; // 1 Gbps
    let bdpBytes = 0;
    let tcpRmemBytes = 4194304; // 4MB default max

    function calcBDP() {
      // BDP = (Bandwidth in bps * RTT in sec) / 8
      bdpBytes = Math.round(((bandwidthMbps * 1e6) * (rttMs / 1000)) / 8);
      render();
    }

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.slider(controls, {
      label: 'RTT Latency (ms)',
      min: 5,
      max: 200,
      step: 5,
      value: rttMs,
      onChange: (v) => { rttMs = parseFloat(v); calcBDP(); }
    });

    OS.slider(controls, {
      label: 'Link Bandwidth (Mbps)',
      min: 100,
      max: 10000,
      step: 500,
      value: bandwidthMbps,
      onChange: (v) => { bandwidthMbps = parseFloat(v); calcBDP(); }
    });

    OS.button(controls, 'Autotune tcp_rmem / tcp_wmem', () => {
      tcpRmemBytes = Math.max(tcpRmemBytes, bdpBytes * 2);
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('TCP Bandwidth-Delay Product (BDP) & Socket Buffer Autotuning', 16, 24);

        const isBufferStarved = bdpBytes > tcpRmemBytes;
        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = isBufferStarved ? OS.C.red : OS.C.green;
        ctx.fillText(isBufferStarved 
          ? `⚠️ BUFFER BOTTLENECK: BDP (${(bdpBytes / 1024 / 1024).toFixed(1)}MB) exceeds tcp_rmem (${(tcpRmemBytes / 1024 / 1024).toFixed(1)}MB)! Window stalled!`
          : `✓ TUNED: TCP window buffer (${(tcpRmemBytes / 1024 / 1024).toFixed(1)}MB) fully accommodates BDP pipe capacity.`, 16, 46);

        // BDP vs Buffer comparison
        const barX = 16;
        const barY = 75;
        const barW = Math.min(480, w - 32);
        const barH = 36;

        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        const maxScale = Math.max(bdpBytes, tcpRmemBytes) * 1.2;
        const bdpW = (bdpBytes / maxScale) * barW;
        ctx.fillStyle = OS.C.accent;
        ctx.fillRect(barX, barY, bdpW, barH);

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`Required BDP: ${(bdpBytes / 1024 / 1024).toFixed(2)} MB`, barX + 8, barY + 22);

        // Limit line
        const limX = barX + (tcpRmemBytes / maxScale) * barW;
        ctx.strokeStyle = isBufferStarved ? OS.C.red : OS.C.green;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(limX, barY - 4);
        ctx.lineTo(limX, barY + barH + 4);
        ctx.stroke();

        ctx.font = OS.font(9, 'mono', 600);
        ctx.fillStyle = isBufferStarved ? OS.C.red : OS.C.green;
        ctx.fillText(`▲ tcp_rmem max (${(tcpRmemBytes / 1024 / 1024).toFixed(1)}MB)`, Math.min(barW - 120, limX - 50), barY + barH + 18);

        // Guidance footer
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Linux autotunes net.ipv4.tcp_rmem and net.ipv4.tcp_wmem (min, default, max bytes).', 16, h - 16);
      }
    });
    calcBDP();
  });

  /* --------------------------------------------------------------------------
   * 14. eBPF Engine Architecture: Verifier, JIT Compiler & Kernel Probes
   * -------------------------------------------------------------------------- */
  OS.register('ebpfEngine', function (host) {
    let verifierStatus = 'PASSED';
    let hookType = 'KPROBE'; // 'KPROBE', 'TRACEPOINT', 'XDP'
    let eventsCaptured = 412;
    let logMsg = 'eBPF Program: Verified safe (no unbounded loops, valid memory dereferences). JIT-compiled to native x86 machine code.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'eBPF Attachment Point', [
      { value: 'KPROBE', label: 'kprobe (Dynamic kernel function entry: tcp_v4_connect)' },
      { value: 'TRACEPOINT', label: 'tracepoint (Stable kernel event: sched:sched_switch)' },
      { value: 'XDP', label: 'XDP (eXpress Data Path: Direct packet filter at NIC driver)' }
    ], (val) => {
      hookType = val;
      logMsg = `Attached eBPF bytecode to ${val} hook.`;
      render();
    });

    OS.button(controls, 'Simulate Safety Violation (Verifier Rejection)', () => {
      verifierStatus = 'REJECTED';
      logMsg = '❌ BPF VERIFIER ABORT: Program contains potential unbounded loop / out-of-bounds pointer arithmetic!';
      render();
    }, { primary: true });

    OS.button(controls, 'Load Valid BPF Bytecode', () => {
      verifierStatus = 'PASSED';
      logMsg = '✓ VERIFIER OK: Checked 142 instructions. JIT compiled to native machine code in kernel.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`eBPF Architecture: Bytecode ➔ Verifier ➔ JIT Compiler ➔ Kernel Maps`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = verifierStatus === 'REJECTED' ? OS.C.red : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // 4 Components
        const comps = [
          { title: '1. Clang / LLVM', desc: 'C ➔ BPF Bytecode' },
          { title: '2. In-Kernel Verifier', desc: verifierStatus === 'PASSED' ? 'DAG checked (Safe)' : 'FAILED!' },
          { title: '3. JIT Compiler', desc: 'x86_64 Machine Code' },
          { title: '4. BPF Maps', desc: 'Hash / Ringbuf in RAM' }
        ];

        const boxW = Math.min(125, (w - 60) / comps.length);
        const boxH = 75;
        const startY = 80;

        comps.forEach((c, idx) => {
          const bx = 16 + idx * (boxW + 12);
          const isError = idx === 1 && verifierStatus === 'REJECTED';

          ctx.fillStyle = isError ? OS.rgba(OS.C.red, 0.2) : OS.rgba(OS.C.accent, 0.1);
          ctx.strokeStyle = isError ? OS.C.red : OS.C.border;
          ctx.beginPath();
          ctx.roundRect(bx, startY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(c.title, bx + 6, startY + 22);

          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillStyle = isError ? OS.C.red : OS.C.muted;
          ctx.fillText(c.desc, bx + 6, startY + 45);

          if (idx < comps.length - 1) {
            ctx.strokeStyle = OS.C.muted;
            ctx.beginPath();
            ctx.moveTo(bx + boxW, startY + boxH / 2);
            ctx.lineTo(bx + boxW + 12, startY + boxH / 2);
            ctx.stroke();
          }
        });

        // Footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Target: [${hookType}] | Events Logged to Ringbuf: ${eventsCaptured} events/sec`, 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 15. Profiling with Flame Graphs: On-CPU vs Off-CPU Profiling
   * -------------------------------------------------------------------------- */
  OS.register('flameGraphExplorer', function (host) {
    let profileType = 'ON_CPU'; // 'ON_CPU' vs 'OFF_CPU'
    let selectedFrame = 'None';
    let statusText = 'Flame Graph: Horizontal width represents proportion of sampled CPU time. Hierarchy represents call stack depth.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Profile Mode', [
      { value: 'ON_CPU', label: 'On-CPU Profiling (Where threads spend active CPU cycles)' },
      { value: 'OFF_CPU', label: 'Off-CPU Profiling (Where threads are blocked / sleeping in I/O)' }
    ], (val) => {
      profileType = val;
      selectedFrame = 'None';
      statusText = val === 'ON_CPU'
        ? 'On-CPU: Sampled via perf record -F 99 -g. Identifies algorithmic bottlenecks & compute churn.'
        : 'Off-CPU: Sampled via eBPF offcputime. Identifies lock contention, disk read waits, and socket stalls!';
      render();
    });

    OS.button(controls, 'Inspect Hot Flame Frame', () => {
      selectedFrame = profileType === 'ON_CPU' ? 'do_lookup_x -> strcmp (42% CPU)' : 'sys_read -> blk_wait (68% Blocked)';
      statusText = `Selected: ${selectedFrame}`;
      render();
    }, { primary: true });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Brendan Gregg's Flame Graph Explorer (${profileType})`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(statusText, 16, 46);

        // Draw Flame Graph Tiers (Stack frames)
        const frameW = Math.min(500, w - 32);
        const startX = 16;
        const fH = 24;
        const bY = 180;

        // Level 0: [all] (Base)
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.4);
        ctx.fillRect(startX, bY, frameW, fH);
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(9, 'mono', 600);
        ctx.fillText('all (100%)', startX + 10, bY + 16);

        // Level 1: System Calls / User
        const w1 = frameW * 0.65;
        const w2 = frameW * 0.35;
        ctx.fillStyle = profileType === 'ON_CPU' ? OS.C.amber : OS.C.teal;
        ctx.fillRect(startX, bY - fH - 2, w1, fH);
        ctx.fillStyle = profileType === 'ON_CPU' ? OS.C.green : OS.C.accent;
        ctx.fillRect(startX + w1 + 2, bY - fH - 2, w2 - 2, fH);

        ctx.fillStyle = OS.C.ink;
        ctx.fillText(profileType === 'ON_CPU' ? 'engine_worker (65%)' : 'pthread_mutex_lock (35%)', startX + 8, bY - fH + 14);
        ctx.fillText(profileType === 'ON_CPU' ? 'gc_thread (35%)' : 'epoll_wait (65%)', startX + w1 + 10, bY - fH + 14);

        // Level 2: Deep inner functions
        const w3 = w1 * 0.7;
        ctx.fillStyle = profileType === 'ON_CPU' ? OS.C.red : OS.C.amber;
        ctx.fillRect(startX, bY - (fH * 2) - 4, w3, fH);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(profileType === 'ON_CPU' ? 'hot_hash_lookup (45%)' : 'disk_io_schedule (24%)', startX + 8, bY - (fH * 2) + 12);

        // Footer
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Frame Inspector: [${selectedFrame}] | Top-down: Call stack depth. Width: Sample count.`, 16, h - 16);
      }
    });
    render();
  });

})();
