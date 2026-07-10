# Edge Equipment Catalog 📋

You run edge hardware. You've debugged why an agent works on one device but fails on others. The cause is rarely your code; it's undocumented hardware quirks, firmware versions, or resource limits that live only in team chat logs.

This catalog provides a shared, machine-readable specification for edge hardware and software. It replaces tribal knowledge with structured data you can use in your deployment tools.

---

## Why This Exists

Teams repeatedly build internal hardware registries. This rebuilds the same foundation: documenting USB bus limits, RAM overhead for specific OS images, and firmware compatibility. This project provides that common base so you don't have to.

---

## Quick Start

1.  **Fork this repository.** This is now your owned copy.
2.  Use the schemas directly. The catalog is plain JSON Schema (Draft 2020-12)
    plus pure TypeScript — no build step is required to read it:
    *   `schemas/equipment.schema.json` — the profile schema.
    *   `schemas/equipment/*.json` — one profile per supported device.
    *   `src/compatibility.ts` — `checkCompatibility(requirements, profile)` for
        validating an agent's requirements against a profile.
3.  Validate profiles and run the example checks (Node.js required):
    ```bash
    npm install
    npm test     # ts-node: validates every profile + runs compatibility cases
    npm run build  # optional: type-check / emit to dist/
    ```
4.  Add your own hardware profiles under `schemas/equipment/` and your own
    compatibility rules in `src/`.

> 🔮 **Planned: hosted reference catalog.** A read-only, hosted mirror of this
> catalog was previously linked here, but it is **not currently deployed**
> (the old URL returns HTTP 404). Treat the repository above as the source of
> truth for now; a hosted mirror may return later.

---

## What's Inside

*   **Typed Definitions:** Structured profiles for edge device models. The base
    catalog currently ships **5** profiles — Raspberry Pi 4 Model B, Raspberry
    Pi 5, NVIDIA Jetson Orin Nano, NVIDIA Jetson AGX Orin, and BeagleBone Black
    — each validating against `schemas/equipment.schema.json`.
*   **Compatibility Checks:** `checkCompatibility()` in `src/compatibility.ts`
    validates whether an agent's requirements (minimum RAM, CPU cores/arch,
    required GPU/AI accelerator, USB port count/revision, storage interface,
    supported image) match a device's capabilities before deployment.
*   **Zero Runtime Dependencies:** The schema is pure JSON Schema and the
    compatibility checker is pure TypeScript with no runtime dependencies.
    Dev/test tooling (ajv, TypeScript, ts-node) is optional and dev-only.
*   **Fork-First Workflow:** You control your catalog. Modify it freely and pull upstream updates when you choose.

---

## How It Works

A schema-first specification. The catalog defines the shape of equipment data and compatibility rules. Your schedulers, provisioning systems, or agent frameworks can load these schemas to validate workloads against hardware capabilities.

---

## Limitations

The base catalog is designed for general-purpose edge devices. **It does not model real-time performance characteristics or dynamic environmental constraints.** For example, it can specify a GPU exists but not its current thermal state or actual inference latency under load. You will add and maintain profiles for highly specialized or custom hardware.

---

## Extending

Add your equipment profiles under `schemas/equipment/` in your fork. You can pull updates from the upstream `main` branch to merge new base definitions when it suits your needs.

---

## Contributing

Corrections and additions for widely-used public hardware are welcome. Please open an issue to discuss significant changes.

## License

MIT License.

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>