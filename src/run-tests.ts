/**
 * Runnable verification for the Edge Equipment Catalog.
 *
 * Part A — schema validation: every profile in schemas/equipment/*.json is
 * validated against schemas/equipment.schema.json with ajv (Draft 2020-12).
 *
 * Part B — compatibility checks: a few representative requirement sets are
 * run against the loaded profiles and their pass/fail outcome is asserted.
 *
 * Run with:  npm test      (== ts-node src/run-tests.ts)
 * Exits non-zero on any failure.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";

import {
  checkCompatibility,
  totalUsbPorts,
  type CompatibilityRequirements,
  type EquipmentProfile,
} from "./compatibility";

const ROOT = resolve(__dirname, "..");
const SCHEMA_DIR = join(ROOT, "schemas");
const EQUIPMENT_DIR = join(SCHEMA_DIR, "equipment");

function loadJson(file: string): any {
  return JSON.parse(readFileSync(file, "utf8"));
}

let failures = 0;
function fail(msg: string): void {
  failures++;
  console.error(`  ✗ ${msg}`);
}
function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function assert(condition: boolean, message: string): void {
  if (condition) ok(message);
  else fail(message);
}

console.log("\n=== Part A: schema validation ===\n");

const schema = loadJson(join(SCHEMA_DIR, "equipment.schema.json"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema) as ValidateFunction<EquipmentProfile>;

const profileFiles = readdirSync(EQUIPMENT_DIR).filter((f) =>
  f.endsWith(".json"),
);

assert(profileFiles.length === 5, `found 5 equipment profiles (found ${profileFiles.length})`);

const profiles: EquipmentProfile[] = [];
for (const file of profileFiles) {
  const data = loadJson(join(EQUIPMENT_DIR, file));
  if (validate(data)) {
    ok(`${file} validates against equipment.schema.json`);
    profiles.push(data);
  } else {
    fail(`${file} FAILED schema validation`);
    console.error(
      "    " +
        ajv.errorsText(validate.errors, { separator: "\n    " }),
    );
  }
}

const byId = new Map(profiles.map((p) => [p.deviceId, p]));
function must(id: string): EquipmentProfile {
  const p = byId.get(id);
  if (!p) throw new Error(`profile ${id} not loaded`);
  return p;
}

console.log("\n=== Part B: compatibility checks ===\n");

interface Case {
  name: string;
  requirements: CompatibilityRequirements;
  profile: EquipmentProfile;
  expectCompatible: boolean;
}

const cases: Case[] = [
  {
    name: "AGX Orin satisfies a heavy vision-agent requirement set",
    profile: must("nvidia-jetson-agx-orin"),
    expectCompatible: true,
    requirements: {
      minMemoryMb: 16384,
      minCpuCores: 8,
      requireAiAccelerator: true,
      requiredStorageInterface: "nvme-m2",
      minUsbVersion: 3,
    },
  },
  {
    name: "BeagleBone Black fails a 64-bit + accelerator requirement set",
    profile: must("beaglebone-black"),
    expectCompatible: false,
    requirements: {
      cpuArchitectures: ["aarch64", "x86_64"],
      minMemoryMb: 1024,
      requireAiAccelerator: true,
      minUsbPorts: 3,
    },
  },
  {
    name: "Raspberry Pi 5 satisfies a lightweight 64-bit agent",
    profile: must("raspberry-pi-5"),
    expectCompatible: true,
    requirements: {
      minMemoryMb: 4096,
      minCpuCores: 4,
      cpuArchitectures: ["aarch64"],
      requireGpu: true,
      minUsbPorts: 4,
    },
  },
  {
    name: "Raspberry Pi 4 fails an NVMe requirement",
    profile: must("raspberry-pi-4-model-b"),
    expectCompatible: false,
    requirements: {
      requiredStorageInterface: "nvme-m2",
    },
  },
  {
    name: "Jetson Orin Nano satisfies a CUDA requirement but fails 16GB RAM",
    profile: must("nvidia-jetson-orin-nano"),
    expectCompatible: false,
    requirements: {
      requireAiAccelerator: true,
      minMemoryMb: 16384,
    },
  },
];

for (const c of cases) {
  const result = checkCompatibility(c.requirements, c.profile);
  const passed = result.compatible === c.expectCompatible;
  if (passed) {
    ok(`[${c.profile.deviceId}] ${c.name} (compatible=${result.compatible})`);
  } else {
    fail(`[${c.profile.deviceId}] ${c.name}: expected compatible=${c.expectCompatible}, got ${result.compatible}`);
  }
  if (result.reasons.length) {
    for (const reason of result.reasons) console.log(`      - ${reason}`);
  }
}

// A couple of explicit numeric sanity checks on the helper functions.
console.log("\n=== helper sanity checks ===\n");
assert(totalUsbPorts(must("raspberry-pi-4-model-b")) === 4, "Pi 4 has 4 total USB ports");
assert(totalUsbPorts(must("beaglebone-black")) === 2, "BeagleBone Black has 2 USB ports");
assert(
  checkCompatibility({}, must("raspberry-pi-5")).compatible === true,
  "empty requirements match every profile",
);

console.log("\n=== Summary ===");
if (failures === 0) {
  console.log("All checks passed.\n");
  process.exit(0);
} else {
  console.error(`${failures} check(s) FAILED.\n`);
  process.exit(1);
}
