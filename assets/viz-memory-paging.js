/* ==========================================================================
   Systems Performance, Flame by Flame — Memory Subsystem & Kernel Paging
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 05. Virtual Memory Translation, Page Tables & TLB Shootdowns
   * -------------------------------------------------------------------------- */
  OS.register('tlbShootdown', function (host) {
    let tlbState = 'HIT'; // 'HIT', 'MISS', 'SHOOTDOWN'
    let latencyCycles = 1;
    let shootdownCores = 0;
    let logMsg = 'TLB HIT: Virtual address 0x7ffd1024 translated in L1 Data TLB cache in ~1 CPU cycle!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Simulate TLB Hit (Hot Loop)', () => {
      tlbState = 'HIT';
      latencyCycles = 1;
      shootdownCores = 0;
      logMsg = 'TLB HIT: Translation cached in Hardware TLB. MMU completes address translation in ~1 cycle.';
      render();
    }, { primary: true });

    OS.button(controls, 'Simulate TLB Miss (4-Level Page Walk)', () => {
      tlbState = 'MISS';
      latencyCycles = 180;
      shootdownCores = 0;
      logMsg = 'TLB MISS: MMU hardware page walker must traverse PML4 ➔ PDPT ➔ PD ➔ PT in DRAM (~180 CPU cycles)!';
      render();
    });

    OS.button(controls, 'Trigger Munmap / TLB Shootdown', () => {
      tlbState = 'SHOOTDOWN';
      latencyCycles = 12500;
      shootdownCores = 16;
      logMsg = '⚡ TLB SHOOTDOWN: Page unmapped! Core 0 broadcasts Inter-Processor Interrupts (IPIs) to all 16 cores, halting CPU pipelines until invalidation completes!';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('x86_64 Virtual Address Translation & Multi-Core TLB Shootdown (IPI)', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = tlbState === 'SHOOTDOWN' ? OS.C.red : (tlbState === 'MISS' ? OS.C.amber : OS.C.green);
        ctx.fillText(logMsg, 16, 46);

        // 4-Level Page Walk Visualization
        const steps = [
          { name: 'PML4 (CR3)', bits: 'Bits 47-39' },
          { name: 'PDPT', bits: 'Bits 38-30' },
          { name: 'Page Dir', bits: 'Bits 29-21' },
          { name: 'Page Table', bits: 'Bits 20-12' },
          { name: 'Physical Frame', bits: 'Offset 11-0' }
        ];

        const boxW = Math.min(85, (w - 60) / steps.length);
        const boxH = 65;
        const startY = 80;

        steps.forEach((s, idx) => {
          const bx = 16 + idx * (boxW + 12);
          const isTraversed = tlbState === 'MISS';

          ctx.fillStyle = isTraversed ? OS.rgba(OS.C.amber, 0.2) : OS.rgba(OS.C.accent, 0.08);
          ctx.strokeStyle = isTraversed ? OS.C.amber : OS.C.border;
          ctx.beginPath();
          ctx.roundRect(bx, startY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(s.name, bx + 6, startY + 22);

          ctx.font = OS.font(9, 'mono', 400);
          ctx.fillStyle = OS.C.muted;
          ctx.fillText(s.bits, bx + 6, startY + 45);

          // Arrow
          if (idx < steps.length - 1) {
            ctx.strokeStyle = OS.C.muted;
            ctx.beginPath();
            ctx.moveTo(bx + boxW, startY + boxH / 2);
            ctx.lineTo(bx + boxW + 12, startY + boxH / 2);
            ctx.stroke();
          }
        });

        // Summary Card
        const cardY = startY + boxH + 18;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`State: [${tlbState}] | Translation Latency: ~${latencyCycles} cycles | Cross-Core IPIs: ${shootdownCores}`, 16, cardY + 16);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('HugePages (2MB / 1GB) bypass Page Table levels, reducing TLB miss rate by 90%+ in high-memory workloads.', 16, cardY + 36);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 06. Page Fault Pipeline: Minor vs Major Faults & RSS
   * -------------------------------------------------------------------------- */
  OS.register('pageFaultPipeline', function (host) {
    let faultType = 'MINOR'; // 'MINOR' vs 'MAJOR'
    let virtMb = 1024;
    let rssMb = 128;
    let minorFaults = 1420;
    let majorFaults = 0;
    let latency = '3.5 microseconds';
    let statusText = 'Minor Page Fault (Demand Zero / COW): Page allocated from free RAM list. Zero disk I/O!';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.select(controls, 'Fault Scenario', [
      { value: 'MINOR', label: 'Minor Fault: Demand-Paging Anonymous Memory (malloc + first write)' },
      { value: 'COW', label: 'Minor Fault: Copy-on-Write (fork() child process memory write)' },
      { value: 'MAJOR', label: 'Major Fault: Disk Swap / Executable mmap Cold Miss (Disk Read)' }
    ], (val) => {
      faultType = val;
      if (val === 'MAJOR') {
        latency = '4.2 milliseconds';
        statusText = 'Major Page Fault: Process blocked! Kernel issued synchronous NVMe/disk read to load page into Page Cache.';
      } else if (val === 'COW') {
        latency = '2.8 microseconds';
        statusText = 'Copy-on-Write Fault: Kernel duplicated shared page frame and mapped new writable page into child mm_struct.';
      } else {
        latency = '3.5 microseconds';
        statusText = 'Minor Fault: Demand zero page attached to VMA from kernel page frame freelist.';
      }
      render();
    });

    OS.button(controls, 'Touch 64MB Unallocated Memory', () => {
      rssMb += 64;
      if (faultType === 'MAJOR') {
        majorFaults += 16384;
      } else {
        minorFaults += 16384;
      }
      statusText = `Touched 64MB: RSS grew from ${rssMb - 64}MB to ${rssMb}MB. Added 16,384 page faults (4KB pages).`;
      render();
    }, { primary: true });

    OS.button(controls, 'Reset Memory Profile', () => {
      rssMb = 128;
      minorFaults = 1420;
      majorFaults = 0;
      statusText = 'Reset memory state.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Linux Page Fault Pipeline: Minor (Anonymous) vs Major (Disk I/O) Faults`, 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = faultType === 'MAJOR' ? OS.C.red : OS.C.green;
        ctx.fillText(statusText, 16, 46);

        // Memory gauge: VIRT vs RSS
        const gaugeX = 16;
        const gaugeY = 75;
        const gaugeW = Math.min(320, w - 32);
        const gaugeH = 32;

        // VIRT container
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 4);
        ctx.fill();
        ctx.stroke();

        // RSS active portion
        const rssW = (rssMb / virtMb) * gaugeW;
        ctx.fillStyle = faultType === 'MAJOR' ? OS.C.red : OS.C.accent;
        ctx.beginPath();
        ctx.roundRect(gaugeX, gaugeY, rssW, gaugeH, 4);
        ctx.fill();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`Resident Set (RSS): ${rssMb}MB`, gaugeX + 8, gaugeY + 20);
        ctx.fillText(`Virtual (VIRT): ${virtMb}MB`, gaugeX + gaugeW - 140, gaugeY + 20);

        // Metrics breakdown card
        const cardY = gaugeY + gaugeH + 20;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Fault Resolution Latency: ${latency}`, 16, cardY + 16);

        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.green;
        ctx.fillText(`• Minor Page Faults (No Disk): ${minorFaults.toLocaleString()}`, 16, cardY + 38);
        ctx.fillStyle = majorFaults > 0 ? OS.C.red : OS.C.muted;
        ctx.fillText(`• Major Page Faults (Disk Read): ${majorFaults.toLocaleString()}`, 16, cardY + 56);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Observe via /usr/bin/time -v or SAR: "majorpagefaults" indicate active disk thrashing!', 16, h - 16);
      }
    });
    render();
  });

  /* --------------------------------------------------------------------------
   * 07. Linux Page Cache Dynamics & Dirty Writeback
   * -------------------------------------------------------------------------- */
  OS.register('pageCacheWriteback', function (host) {
    let dirtyMb = 1200;
    let totalRamMb = 8192;
    let bgRatio = 10; // % vm.dirty_background_ratio (~819MB)
    let dirtyRatio = 20; // % vm.dirty_ratio (~1638MB)
    let state = 'CLEAN'; // 'CLEAN', 'BG_FLUSH', 'THROTTLED'
    let statusText = 'Page Cache in normal state. Writes append to kernel memory without blocking user threads.';

    function updateState() {
      const bgThresh = (bgRatio / 100) * totalRamMb;
      const hardThresh = (dirtyRatio / 100) * totalRamMb;

      if (dirtyMb >= hardThresh) {
        state = 'THROTTLED';
        statusText = '🚨 DIRTY_RATIO BREACHED: User write() calls BLOCKED! Threads forced into synchronous writeout!';
      } else if (dirtyMb >= bgThresh) {
        state = 'BG_FLUSH';
        statusText = '⚡ DIRTY_BG_RATIO EXCEEDED: Kernel wake up wb_workqueue / kworker threads for asynchronous background flush.';
      } else {
        state = 'CLEAN';
        statusText = 'Page Cache healthy. Dirty memory below background writeback threshold.';
      }
      render();
    }

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Write 500MB (Appends to Page Cache)', () => {
      dirtyMb += 500;
      updateState();
    }, { primary: true });

    OS.button(controls, 'Call sync() (Flush All to Disk)', () => {
      dirtyMb = 0;
      updateState();
    });

    OS.button(controls, 'Reset Page Cache', () => {
      dirtyMb = 400;
      updateState();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Linux Page Cache Dirty Memory Writeback (vm.dirty_ratio & vm.dirty_background_ratio)', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = state === 'THROTTLED' ? OS.C.red : (state === 'BG_FLUSH' ? OS.C.amber : OS.C.green);
        ctx.fillText(statusText, 16, 46);

        // Memory bar
        const barX = 16;
        const barY = 75;
        const barW = Math.min(500, w - 32);
        const barH = 36;

        ctx.fillStyle = OS.rgba(OS.C.muted, 0.1);
        ctx.strokeStyle = OS.C.border;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        // Dirty bar fill
        const dirtyW = Math.min(barW, (dirtyMb / totalRamMb) * barW);
        ctx.fillStyle = state === 'THROTTLED' ? OS.C.red : (state === 'BG_FLUSH' ? OS.C.amber : OS.C.accent);
        ctx.fillRect(barX, barY, dirtyW, barH);

        // Threshold markers
        const bgX = barX + (bgRatio / 100) * barW;
        ctx.strokeStyle = OS.C.amber;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bgX, barY - 6);
        ctx.lineTo(bgX, barY + barH + 6);
        ctx.stroke();

        const hardX = barX + (dirtyRatio / 100) * barW;
        ctx.strokeStyle = OS.C.red;
        ctx.beginPath();
        ctx.moveTo(hardX, barY - 6);
        ctx.lineTo(hardX, barY + barH + 6);
        ctx.stroke();

        // Marker labels
        ctx.font = OS.font(9, 'mono', 600);
        ctx.fillStyle = OS.C.amber;
        ctx.fillText(`▲ dirty_bg (${bgRatio}%)`, bgX - 35, barY + barH + 18);

        ctx.fillStyle = OS.C.red;
        ctx.fillText(`▲ dirty_ratio (${dirtyRatio}%)`, hardX - 45, barY + barH + 18);

        // Metrics footer
        const cardY = barY + barH + 36;
        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Dirty RAM: ${dirtyMb}MB / ${totalRamMb}MB (${((dirtyMb / totalRamMb) * 100).toFixed(1)}%) | Kernel State: [${state}]`, 16, cardY);

        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('When dirty memory hits vm.dirty_ratio, kernel forces synchronous I/O stalls onto user threads!', 16, cardY + 20);
      }
    });
    updateState();
  });

  /* --------------------------------------------------------------------------
   * 08. Slab / Slub Allocator & Kernel Object Caches
   * -------------------------------------------------------------------------- */
  OS.register('slabAllocator', function (host) {
    const slots = [
      { id: 0, busy: true, obj: 'task_struct' },
      { id: 1, busy: true, obj: 'task_struct' },
      { id: 2, busy: false, obj: null },
      { id: 3, busy: false, obj: null },
      { id: 4, busy: true, obj: 'task_struct' },
      { id: 5, busy: false, obj: null }
    ];
    let logMsg = 'SLUB Allocator: Page frame divided into uniform object slots. Zero internal fragmentation.';

    let cv = null;
    function render() {
      if (cv && cv.redraw) cv.redraw();
    }

    const controls = OS.controls(host);
    OS.button(controls, 'Allocate Object (kmem_cache_alloc)', () => {
      const free = slots.find(s => !s.busy);
      if (free) {
        free.busy = true;
        free.obj = 'task_struct';
        logMsg = `ALLOCATED: Popped Slot #${free.id} from CPU slab freelist in O(1) time without lock contention.`;
      } else {
        logMsg = 'SLAB FULL: Allocating new 4KB page frame from Buddy Allocator to populate fresh slab.';
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Free Object (kmem_cache_free)', () => {
      const busy = slots.find(s => s.busy);
      if (busy) {
        busy.busy = false;
        busy.obj = null;
        logMsg = `FREED: Pushed Slot #${busy.id} back to per-CPU freelist. Fast L1-cache warm reuse.`;
      }
      render();
    });

    OS.button(controls, 'Reset Slab Page', () => {
      slots[0].busy = true;
      slots[1].busy = true;
      slots[2].busy = false;
      slots[3].busy = false;
      slots[4].busy = true;
      slots[5].busy = false;
      logMsg = 'Slab state reset.';
      render();
    });

    cv = OS.canvas(host, {
      height: 250,
      render: function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        ctx.font = OS.font(13, 'display', 600);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Linux SLUB Allocator: kmem_cache Slab Slicing & Per-CPU Freelist', 16, 24);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = logMsg.includes('FULL') ? OS.C.amber : OS.C.green;
        ctx.fillText(logMsg, 16, 46);

        // Draw slots inside 4KB Page Slab
        const slotW = Math.min(80, (w - 60) / slots.length);
        const slotH = 75;
        const startY = 80;

        slots.forEach((s, idx) => {
          const sx = 16 + idx * (slotW + 12);

          ctx.fillStyle = s.busy ? OS.rgba(OS.C.accent, 0.2) : OS.rgba(OS.C.muted, 0.08);
          ctx.strokeStyle = s.busy ? OS.C.accent : OS.C.border;
          ctx.beginPath();
          ctx.roundRect(sx, startY, slotW, slotH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 700);
          ctx.fillText(`Slot #${s.id}`, sx + 8, startY + 22);

          ctx.font = OS.font(9, 'mono', 500);
          ctx.fillStyle = s.busy ? OS.C.accent : OS.C.green;
          ctx.fillText(s.busy ? 'ALLOCATED' : 'FREE', sx + 8, startY + 45);

          ctx.fillStyle = OS.C.muted;
          ctx.font = OS.font(9, 'sans', 400);
          ctx.fillText(s.busy ? '512B Obj' : 'Freelist ->', sx + 8, startY + 62);
        });

        // Summary footer
        const busyCount = slots.filter(s => s.busy).length;
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Slab Status: ${busyCount}/${slots.length} Slots Busy | Inspect via /proc/slabinfo or slabtop command.`, 16, h - 16);
      }
    });
    render();
  });

})();
