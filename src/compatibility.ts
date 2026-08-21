/**
 * Edge Equipment Catalog — compatibility checking.
 *
 * checkCompatibility() decides whether an agent's deployment requirements
 * can be satisfied by a given hardware profile, returning a list of human-
 * readable reasons for every requirement that is NOT met.
 *
 * Pure functions, zero runtime dependencies. Consumes EquipmentProfile
 * objects (load them from schemas/equipment/*.json and they conform to
 * schemas/equipment.schema.json).
 */

export interface CpuSpec {
  cores: number;
  architecture: string;
  maxClockMhz?: number;
  model?: string;
}

export interface GpuSpec {
  present: boolean;
  model?: string;
  cudaCores?: number;
  tensorCores?: number;
  aiTops?: number;
}

export interface UsbPortGroup {
  version: number;
  count: number;
}

export interface UsbSpec {
  ports: UsbPortGroup[];
}

export interface StorageSpec {
  interfaces: string[];
  details?: string;
}

export interface PowerSpec {
  voltageV?: number;
  typicalDrawW?: number;
  maxDrawW?: number;
  connector?: string;
}

export interface FirmwareCompatibility {
  minFirmware?: string;
  maxFirmware?: string;
  notes?: string;
}

export interface EquipmentProfile {
  deviceId: string;
  manufacturer: string;
  modelName: string;
  releaseYear?: number;
  cpu: CpuSpec;
  memoryMb: number;
  memoryVariantsMb?: number[];
  gpu?: GpuSpec;
  usb?: UsbSpec;
  storage: StorageSpec;
  power?: PowerSpec;
  supportedImages: string[];
  firmwareCompatibility?: FirmwareCompatibility;
  _notes?: string;
  [key: string]: unknown;
}

/**
 * Requirements an agent/deployment places on the target device.
 * Every field is optional; only the ones that are present are evaluated.
 */
export interface CompatibilityRequirements {
  /** Minimum RAM, in megabytes. */
  minMemoryMb?: number;
  /** Minimum number of CPU cores. */
  minCpuCores?: number;
  /** Acceptable CPU architectures (the profile must match one). */
  cpuArchitectures?: string[];
  /** Require any GPU to be present (graphics or compute). */
  requireGpu?: boolean;
  /** Require an AI accelerator: a GPU with CUDA/Tensor cores or a rated aiTops. */
  requireAiAccelerator?: boolean;
  /** Minimum total USB ports across all revisions. */
  minUsbPorts?: number;
  /** Require at least one USB port group at or above this revision (e.g. 3). */
  minUsbVersion?: number;
  /** Require this storage interface to be present (e.g. "nvme-m2"). */
  requiredStorageInterface?: string;
  /** Require a supportedImages entry containing this substring (case-insensitive). */
  supportedImageSubstring?: string;
}

export interface CompatibilityResult {
  /** True only when every supplied requirement is satisfied. */
  compatible: boolean;
  /** One human-readable reason per unsatisfied requirement (empty when compatible). */
  reasons: string[];
}

/** Sum the count across every USB port group on the profile. */
export function totalUsbPorts(profile: EquipmentProfile): number {
  if (!profile.usb?.ports) return 0;
  return profile.usb.ports.reduce((sum, group) => sum + (group.count ?? 0), 0);
}

/** Highest USB revision present on the profile (0 if none reported). */
export function maxUsbVersion(profile: EquipmentProfile): number {
  if (!profile.usb?.ports?.length) return 0;
  return Math.max(...profile.usb.ports.map((group) => group.version ?? 0));
}

/** True when the profile's GPU counts as an AI accelerator. */
export function hasAiAccelerator(profile: EquipmentProfile): boolean {
  const gpu = profile.gpu;
  if (!gpu?.present) return false;
  return (
    (gpu.cudaCores ?? 0) > 0 ||
    (gpu.tensorCores ?? 0) > 0 ||
    (gpu.aiTops ?? 0) > 0
  );
}

/**
 * Validate a profile against a set of requirements.
 * A requirement is "met" when omitted, so an empty requirements object
 * matches every profile.
 */
export function checkCompatibility(
  requirements: CompatibilityRequirements,
  profile: EquipmentProfile,
): CompatibilityResult {
  const reasons: string[] = [];

  if (
    requirements.minMemoryMb !== undefined &&
    profile.memoryMb < requirements.minMemoryMb
  ) {
    reasons.push(
      `requires >= ${requirements.minMemoryMb}MB RAM but device has ${profile.memoryMb}MB`,
    );
  }

  if (
    requirements.minCpuCores !== undefined &&
    profile.cpu.cores < requirements.minCpuCores
  ) {
    reasons.push(
      `requires >= ${requirements.minCpuCores} CPU cores but device has ${profile.cpu.cores}`,
    );
  }

  if (
    requirements.cpuArchitectures?.length &&
    !requirements.cpuArchitectures.includes(profile.cpu.architecture)
  ) {
    reasons.push(
      `requires architecture in [${requirements.cpuArchitectures.join(", ")}] but device is ${profile.cpu.architecture}`,
    );
  }

  if (requirements.requireGpu && !profile.gpu?.present) {
    reasons.push("requires a GPU but device has none");
  }

  if (requirements.requireAiAccelerator && !hasAiAccelerator(profile)) {
    reasons.push("requires an AI accelerator (CUDA/Tensor cores or rated TOPS)");
  }

  if (
    requirements.minUsbPorts !== undefined &&
    totalUsbPorts(profile) < requirements.minUsbPorts
  ) {
    reasons.push(
      `requires >= ${requirements.minUsbPorts} USB ports but device has ${totalUsbPorts(profile)}`,
    );
  }

  if (
    requirements.minUsbVersion !== undefined &&
    maxUsbVersion(profile) < requirements.minUsbVersion
  ) {
    reasons.push(
      `requires USB >= ${requirements.minUsbVersion} but device max is ${maxUsbVersion(profile)}`,
    );
  }

  if (
    requirements.requiredStorageInterface &&
    !profile.storage.interfaces.includes(requirements.requiredStorageInterface)
  ) {
    reasons.push(
      `requires ${requirements.requiredStorageInterface} storage but device only has [${profile.storage.interfaces.join(", ")}]`,
    );
  }

  if (requirements.supportedImageSubstring) {
    const needle = requirements.supportedImageSubstring.toLowerCase();
    const found = profile.supportedImages.some((image) =>
      image.toLowerCase().includes(needle),
    );
    if (!found) {
      reasons.push(
        `requires a supported image matching "${requirements.supportedImageSubstring}"`,
      );
    }
  }

  return { compatible: reasons.length === 0, reasons };
}
