# Systems Performance & Linux Kernel Internals, Flame by Flame

> An interactive, visual field guide to Linux kernel internals, microarchitecture, and systems performance engineering: from CFS CPU scheduling and TLB shootdowns to page cache dirty writeback, io_uring lockless queues, NAPI network softirqs, and eBPF flame graphs.

---

## 🏛️ Curricular Foundations

This curriculum synthesizes principles and diagnostics from:
- **Brendan Gregg**, *Systems Performance: Enterprise and the Cloud* (2nd Edition, Addison-Wesley) & *BPF Performance Tools*
- **Michael Kerrisk**, *The Linux Programming Interface* (TLPI, No Starch Press)
- **Robert Love**, *Linux Kernel Development* (3rd Edition, Addison-Wesley)
- **Ahmad Yasin**, *A Top-Down Method for Performance Analysis and Counters Architecture* (IEEE ISPASS)
- **Jens Axboe**, *Efficient IO with io_uring* (Linux Kernel Documentation)

---

## 🔬 Interactive Simulators Included

| Chapter | Simulator | Key Concepts Demonstrated |
|---|---|---|
| **Figure 00** | `perfHero` | The Law of Queueing, $L_q = \frac{\rho^2}{1-\rho}$ Exponential Knee, USE Method |
| **Chapter 01** | `cfsScheduler` | CFS Red-Black Tree, Nice Weightings, Proportional `vruntime` Progression |
| **Chapter 02** | `contextSwitch` | Register Save, CR3 Address Space Swaps, TLB Invalidation, Cross-Core Affinity |
| **Chapter 03** | `perfCounters` | PMU Topdown Profiling: Retiring, Bad Speculation, Frontend & Backend Bounds |
| **Chapter 04** | `cfsThrottling` | cgroups v2 CFS Bandwidth Control (`cpu.max`), 100ms Slices, Container Freezes |
| **Chapter 05** | `tlbShootdown` | x86_64 4-Level Page Walk (PML4 to PT), TLB Misses, Multi-Core IPI Shootdowns |
| **Chapter 06** | `pageFaultPipeline` | Minor Faults (COW / Anonymous Zero) vs Major Faults (Disk Read) & RSS Growth |
| **Chapter 07** | `pageCacheWriteback` | Page Cache Dirty Memory, `dirty_background_ratio`, `dirty_ratio` Syscall Stalls |
| **Chapter 08** | `slabAllocator` | SLUB Allocator, 4KB Page Slicing, Per-CPU Object Freelist, Zero Fragmentation |
| **Chapter 09** | `blockIoQueue` | Linux Block I/O Layer, BIO Structs, Multi-Queue `blk-mq`, `mq-deadline` vs `none` |
| **Chapter 10** | `ioUringRing` | `io_uring` Lockless Ring Buffers, Shared-Memory SQ & CQ, Syscall Bypass |
| **Chapter 11** | `ebpfDiskLatency` | eBPF `biolatency` Log2 Microsecond Latency Histograms & Tail Outliers |
| **Chapter 12** | `networkNapiRing` | NIC DMA Ring Buffers, HardIRQ Storm Mitigation, NAPI Hybrid Polling, SoftIRQs |
| **Chapter 13** | `skBuffTuning` | Socket Buffers (`sk_buff`), Bandwidth-Delay Product (BDP), TCP Buffer Autotuning |
| **Chapter 14** | `ebpfEngine` | eBPF Architecture: Bytecode, Verifier Safety DAG, JIT Compiler & Kernel Maps |
| **Chapter 15** | `flameGraphExplorer` | Interactive Flame Graph Profiler: On-CPU Compute vs Off-CPU Wait Latency |

---

## 🧪 Automated Testing & Verification

The test harness mounts all 16 simulators across 4 viewports (320px, 480px, 768px, 1200px) and exercises all interactive controls:

```bash
npm test
```

---

## 🚀 Deployment

Zero-build vanilla web architecture. Built with pure HTML5, CSS3, and ES6+ Canvas APIs.
Hosted on GitHub Pages.
